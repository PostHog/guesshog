import { DurableObject } from "cloudflare:workers"
import deck from "../shared/hoggies.json"
import type { ClientMessage, Hog, LiveRoom, ServerMessage } from "../shared/protocol.ts"
import { applyAction, cleanName, join, newRoom, pruneMembers, type RoomState, viewFor } from "./game.ts"

const STORAGE_KEY = "room"
/** Rooms nobody is connected to are deleted after this long. */
const IDLE_TTL_MS = 60 * 60 * 1000
/** Stop one noisy socket from spamming reactions at everyone else. */
const REACTION_COOLDOWN_MS = 400

interface Attachment {
  pid: string
  lastReactionAt?: number
}

export const directory = (env: Env) => env.DIRECTORY.get(env.DIRECTORY.idFromName("global"))

const random = (max: number) => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

/**
 * One Durable Object per room code. It owns the room state, holds every
 * WebSocket in the room (using the hibernation API, so idle rooms cost nothing)
 * and sends each person their own view of the game after every change.
 */
export class GameRoom extends DurableObject<Env> {
  private room: RoomState | null = null
  /** The last summary sent to the directory, so unchanged ones (like card flips) aren't resent. */
  private listed = ""

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>(STORAGE_KEY)) ?? null
    })
  }

  /** Called once by the worker when a room code is handed out. Returns false if the code is taken. */
  async create(code: string): Promise<boolean> {
    if (this.room) return false
    this.room = newRoom(code, Date.now())
    await this.save()
    return true
  }

  async exists(): Promise<boolean> {
    return this.room !== null
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response("Room not found", { status: 404 })
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 })

    const url = new URL(request.url)
    const pid = url.searchParams.get("pid") ?? ""
    const name = cleanName(url.searchParams.get("name")) ?? "Mystery hog"
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(pid)) return new Response("Invalid player id", { status: 400 })

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server, [pid])
    server.serializeAttachment({ pid } satisfies Attachment)

    join(this.room, pid, name, Date.now())
    await this.save()
    this.broadcast()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    if (!this.room || typeof data !== "string") return
    const attachment = ws.deserializeAttachment() as Attachment
    let msg: ClientMessage
    try {
      msg = JSON.parse(data)
    } catch {
      msg = null as unknown as ClientMessage
    }
    if (!msg || typeof msg !== "object") return this.send(ws, { t: "error", message: "That message didn't make sense." })
    if (!this.room.members[attachment.pid]) join(this.room, attachment.pid, "Mystery hog", Date.now())

    const result = applyAction(this.room, attachment.pid, msg, {
      online: this.online(),
      deck: deck as Hog[],
      random,
    })
    if (!result.ok) return this.send(ws, { t: "error", message: result.error })

    if (msg.t === "react") {
      const now = Date.now()
      if (now - (attachment.lastReactionAt ?? 0) < REACTION_COOLDOWN_MS) return
      ws.serializeAttachment({ ...attachment, lastReactionAt: now } satisfies Attachment)
      const name = this.room.members[attachment.pid]?.name ?? "Someone"
      for (const socket of this.sockets()) this.send(socket, { t: "reaction", emoji: msg.emoji, from: attachment.pid, name })
      return
    }

    await this.save()
    this.broadcast()
  }

  async webSocketClose(ws: WebSocket) {
    await this.disconnect(ws)
  }

  async webSocketError(ws: WebSocket) {
    await this.disconnect(ws)
  }

  async alarm() {
    if (this.sockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS)
      return
    }
    const code = this.room?.code
    this.room = null
    await this.ctx.storage.deleteAll()
    if (code) await directory(this.env).remove(code)
  }

  private async disconnect(ws: WebSocket) {
    try {
      ws.close(1000, "bye")
    } catch {
      // already closed
    }
    if (!this.room) return
    pruneMembers(this.room, this.online())
    await this.save()
    this.broadcast()
  }

  private sockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN)
  }

  private online(): Set<string> {
    return new Set(this.sockets().map((ws) => (ws.deserializeAttachment() as Attachment).pid))
  }

  private broadcast() {
    if (!this.room) return
    const online = this.online()
    for (const ws of this.sockets()) {
      const { pid } = ws.deserializeAttachment() as Attachment
      this.send(ws, { t: "state", room: viewFor(this.room, pid, online) })
    }
    this.ctx.waitUntil(this.report(online))
  }

  /** Tell the directory what this room looks like now, or that it's empty. Never breaks the game. */
  private async report(online: Set<string>) {
    const room = this.room
    if (!room) return
    const nameOf = (id: string | null) => (id ? (room.members[id]?.name ?? null) : null)
    const entry: Omit<LiveRoom, "updatedAt"> | null =
      online.size === 0
        ? null
        : {
            code: room.code,
            phase: room.phase,
            players: [nameOf(room.seats[0]), nameOf(room.seats[1])],
            spectators: [...online].filter((id) => !room.seats.includes(id)).length,
          }
    const key = entry ? JSON.stringify(entry) : ""
    if (key === this.listed) return
    this.listed = key
    try {
      if (entry) await directory(this.env).update({ ...entry, updatedAt: Date.now() })
      else await directory(this.env).remove(room.code)
    } catch (error) {
      this.listed = "" // try again on the next change
      console.error("Couldn't update the room directory", error)
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // the socket went away mid-broadcast; its close handler will tidy up
    }
  }

  private async save() {
    if (!this.room) return
    await this.ctx.storage.put(STORAGE_KEY, this.room)
    await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS)
  }
}
