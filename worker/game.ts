// Pure game rules: room state, the actions players can take, and what each
// viewer is allowed to see. No Cloudflare APIs here, so it's easy to test.
import {
  BOARD_SIZE,
  type ClientMessage,
  type EndReason,
  type GameView,
  type Hog,
  type LogEntry,
  MAX_NAME_LENGTH,
  MAX_QUESTION_LENGTH,
  type MemberView,
  type Phase,
  type PlayerView,
  REACTIONS,
  type RoomView,
  type Seat,
  otherSeat,
} from "../shared/protocol.ts"

const MAX_LOG_ENTRIES = 200

export interface Member {
  id: string
  name: string
  joinedAt: number
}

export interface PlayerState {
  secret: number
  flipped: boolean[]
}

export interface GameState {
  round: number
  board: Hog[]
  players: [PlayerState, PlayerState]
  turn: Seat
  log: LogEntry[]
  winner: Seat | null
  endReason: EndReason | null
}

export interface RoomState {
  code: string
  createdAt: number
  members: Record<string, Member>
  seats: [string | null, string | null]
  wins: Record<string, number>
  phase: Phase
  rounds: number
  game: GameState | null
}

/** Returns a random integer in [0, max). Injected so tests can be deterministic. */
export type Random = (max: number) => number

export type ActionResult = { ok: true } | { ok: false; error: string }

const ok: ActionResult = { ok: true }
const fail = (error: string): ActionResult => ({ ok: false, error })

export function newRoom(code: string, now: number): RoomState {
  return { code, createdAt: now, members: {}, seats: [null, null], wins: {}, phase: "lobby", rounds: 0, game: null }
}

export function cleanName(input: unknown): string | null {
  if (typeof input !== "string") return null
  const name = input.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH)
  return name.length > 0 ? name : null
}

export function join(room: RoomState, id: string, name: string, now: number) {
  const existing = room.members[id]
  room.members[id] = { id, name, joinedAt: existing?.joinedAt ?? now }
}

/** Forget people who left and aren't holding a seat. */
export function pruneMembers(room: RoomState, online: Set<string>) {
  for (const id of Object.keys(room.members)) {
    if (!online.has(id) && !room.seats.includes(id)) delete room.members[id]
  }
}

export function seatOf(room: RoomState, id: string): Seat | null {
  if (room.seats[0] === id) return 0
  if (room.seats[1] === id) return 1
  return null
}

function shuffle<T>(items: T[], random: Random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function deal(room: RoomState, deck: Hog[], random: Random) {
  const board = shuffle(deck, random).slice(0, BOARD_SIZE)
  const first = random(board.length)
  const second = (first + 1 + random(board.length - 1)) % board.length // never the same hog twice
  room.rounds += 1
  room.phase = "playing"
  room.game = {
    round: room.rounds,
    board,
    players: [
      { secret: first, flipped: board.map(() => false) },
      { secret: second, flipped: board.map(() => false) },
    ],
    turn: random(2) as Seat,
    log: [],
    winner: null,
    endReason: null,
  }
}

const isSeat = (value: unknown): value is Seat => value === 0 || value === 1
const isCardIndex = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_SIZE

function awaitingAnswer(game: GameState): boolean {
  const last = game.log.at(-1)
  return last?.kind === "question" && last.answer === null
}

type NewLogEntry = LogEntry extends infer E ? (E extends LogEntry ? Omit<E, "id"> : never) : never

function pushLog(game: GameState, entry: NewLogEntry) {
  const id = (game.log.at(-1)?.id ?? 0) + 1
  game.log.push({ ...entry, id } as LogEntry)
  if (game.log.length > MAX_LOG_ENTRIES) game.log.splice(0, game.log.length - MAX_LOG_ENTRIES)
}

function finish(room: RoomState, winner: Seat, reason: EndReason) {
  const game = room.game!
  game.winner = winner
  game.endReason = reason
  room.phase = "finished"
  const winnerId = room.seats[winner]
  if (winnerId) room.wins[winnerId] = (room.wins[winnerId] ?? 0) + 1
}

export interface ActionContext {
  online: Set<string>
  deck: Hog[]
  random: Random
}

export function applyAction(room: RoomState, actor: string, msg: ClientMessage, ctx: ActionContext): ActionResult {
  const seat = seatOf(room, actor)
  const game = room.game

  switch (msg.t) {
    case "rename": {
      const name = cleanName(msg.name)
      if (!name) return fail("Names need at least one character.")
      room.members[actor].name = name
      return ok
    }

    case "sit": {
      if (room.phase !== "lobby") return fail("Seats are locked until this round ends.")
      if (!isSeat(msg.seat)) return fail("That seat doesn't exist.")
      if (room.seats[msg.seat] !== null) return fail("Someone is already sitting there.")
      if (seat !== null) room.seats[seat] = null
      room.seats[msg.seat] = actor
      return ok
    }

    case "stand": {
      if (room.phase !== "lobby") return fail("Seats are locked until this round ends.")
      if (seat === null) return fail("You're not in a seat.")
      room.seats[seat] = null
      return ok
    }

    case "clearSeat": {
      if (room.phase !== "lobby") return fail("Seats are locked until this round ends.")
      if (!isSeat(msg.seat)) return fail("That seat doesn't exist.")
      const occupant = room.seats[msg.seat]
      if (occupant && occupant !== actor && ctx.online.has(occupant)) {
        return fail("You can only free a seat when its player has left.")
      }
      room.seats[msg.seat] = null
      pruneMembers(room, ctx.online)
      return ok
    }

    case "start":
    case "rematch": {
      if (msg.t === "start" && room.phase !== "lobby") return fail("The game has already started.")
      if (msg.t === "rematch" && room.phase !== "finished") return fail("Finish this round first.")
      const [a, b] = room.seats
      if (!a || !b) return fail("Both seats need a player.")
      if (!ctx.online.has(a) || !ctx.online.has(b)) return fail("Both players need to be here.")
      deal(room, ctx.deck, ctx.random)
      return ok
    }

    case "ask": {
      if (room.phase !== "playing" || !game) return fail("There's no game running.")
      if (seat === null) return fail("Only players can ask questions.")
      if (game.turn !== seat) return fail("It's not your turn.")
      if (awaitingAnswer(game)) return fail("Wait for the answer to your last question.")
      const text = typeof msg.text === "string" ? msg.text.replace(/\s+/g, " ").trim() : ""
      if (!text) return fail("Type a question first.")
      if (text.length > MAX_QUESTION_LENGTH) return fail(`Keep questions under ${MAX_QUESTION_LENGTH} characters.`)
      pushLog(game, { seat, kind: "question", text, answer: null })
      return ok
    }

    case "answer": {
      if (room.phase !== "playing" || !game) return fail("There's no game running.")
      if (!awaitingAnswer(game)) return fail("There's no question to answer.")
      if (seat !== otherSeat(game.turn)) return fail("Only the other player can answer.")
      const last = game.log.at(-1)
      if (last?.kind === "question") last.answer = msg.yes === true
      game.turn = seat
      return ok
    }

    case "flip": {
      if (room.phase !== "playing" || !game) return fail("There's no game running.")
      if (seat === null) return fail("Only players can flip cards.")
      if (!isCardIndex(msg.index)) return fail("That card doesn't exist.")
      game.players[seat].flipped[msg.index] = msg.down === true
      return ok
    }

    case "guess": {
      if (room.phase !== "playing" || !game) return fail("There's no game running.")
      if (seat === null) return fail("Only players can guess.")
      if (game.turn !== seat) return fail("It's not your turn.")
      if (awaitingAnswer(game)) return fail("Wait for the answer to your question first.")
      if (!isCardIndex(msg.index)) return fail("That card doesn't exist.")
      const correct = game.players[otherSeat(seat)].secret === msg.index
      pushLog(game, { seat, kind: "guess", hog: msg.index, correct })
      finish(room, correct ? seat : otherSeat(seat), correct ? "guess" : "wrong-guess")
      return ok
    }

    case "forfeit": {
      if (room.phase !== "playing" || !game) return fail("There's no game running.")
      if (seat === null) return fail("Only players can give up.")
      finish(room, otherSeat(seat), "forfeit")
      return ok
    }

    case "lobby": {
      if (room.phase !== "finished") return fail("Finish this round first.")
      room.phase = "lobby"
      room.game = null
      pruneMembers(room, ctx.online)
      return ok
    }

    case "react":
      return REACTIONS.includes(msg.emoji) ? ok : fail("Unknown reaction.")

    default:
      return fail("Unknown action.")
  }
}

/** What one person in the room is allowed to see. Spectators see everything; players see their own side. */
export function viewFor(room: RoomState, viewer: string, online: Set<string>): RoomView {
  const yourSeat = seatOf(room, viewer)
  const members: MemberView[] = Object.values(room.members)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((m) => ({ id: m.id, name: m.name, online: online.has(m.id), seat: seatOf(room, m.id), wins: room.wins[m.id] ?? 0 }))

  let game: GameView | null = null
  if (room.game) {
    const g = room.game
    const seesAll = yourSeat === null || room.phase === "finished"
    const player = (s: Seat): PlayerView => {
      const visible = seesAll || yourSeat === s
      const p = g.players[s]
      return {
        secret: visible ? p.secret : null,
        flipped: visible ? [...p.flipped] : null,
        standing: p.flipped.filter((down) => !down).length,
      }
    }
    game = {
      round: g.round,
      board: g.board,
      turn: g.turn,
      awaitingAnswer: awaitingAnswer(g),
      log: g.log,
      players: [player(0), player(1)],
      winner: g.winner,
      endReason: g.endReason,
    }
  }

  return { code: room.code, you: viewer, yourSeat, phase: room.phase, members, seats: room.seats, game }
}
