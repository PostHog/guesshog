import { normalizeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../shared/protocol.ts"

export { GameRoom } from "./room.ts"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function randomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("")
}

const room = (env: Env, code: string) => env.ROOMS.get(env.ROOMS.idFromName(code))

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomCode()
        if (await room(env, code).create(code)) return json({ code }, 201)
      }
      return json({ error: "Couldn't find a free room code. Try again." }, 503)
    }

    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/ws)?$/)
    if (match) {
      const code = normalizeRoomCode(match[1])
      if (!code) return json({ error: "Room codes are four letters." }, 400)
      if (match[2]) return room(env, code).fetch(request)
      return json({ code, exists: await room(env, code).exists() })
    }

    return json({ error: "Not found" }, 404)
  },
} satisfies ExportedHandler<Env>
