// The wire protocol between the browser and a GameRoom Durable Object.
// Everything here is shared by the client (src/) and the server (worker/).

export const BOARD_SIZE = 24
export const MAX_NAME_LENGTH = 24
export const MAX_QUESTION_LENGTH = 140
export const ROOM_CODE_LENGTH = 4
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ" // no I or O, they look like 1 and 0
export const REACTIONS = ["🦔", "😂", "😱", "🔥", "👏", "🤔"] as const

export type Seat = 0 | 1
export type Phase = "lobby" | "playing" | "finished"
export type Reaction = (typeof REACTIONS)[number]
export type EndReason = "guess" | "wrong-guess" | "forfeit"

export interface Hog {
  id: string
  name: string
}

export type LogEntry =
  | { id: number; seat: Seat; kind: "question"; text: string; answer: boolean | null }
  | { id: number; seat: Seat; kind: "guess"; hog: number; correct: boolean }

export interface MemberView {
  id: string
  name: string
  online: boolean
  seat: Seat | null
  wins: number
}

export interface PlayerView {
  /** Index into the board of this player's secret hog. Null when hidden from the viewer. */
  secret: number | null
  /** Which cards this player has flipped down. Everyone can see these, like the backs of a real board. */
  flipped: boolean[]
  /** How many cards are still standing on this player's board. */
  standing: number
}

export interface GameView {
  round: number
  board: Hog[]
  turn: Seat
  /** True while the player whose turn it is waits for an answer to their question. */
  awaitingAnswer: boolean
  log: LogEntry[]
  players: [PlayerView, PlayerView]
  winner: Seat | null
  endReason: EndReason | null
}

export interface RoomView {
  code: string
  you: string
  yourSeat: Seat | null
  phase: Phase
  members: MemberView[]
  seats: [string | null, string | null]
  game: GameView | null
}

/** A room as listed on the home page. Only rooms with someone connected are listed. */
export interface LiveRoom {
  code: string
  phase: Phase
  /** Names in the Player 1 and Player 2 seats. */
  players: [string | null, string | null]
  /** People connected who aren't in a seat. */
  spectators: number
  updatedAt: number
}

export type ClientMessage =
  | { t: "rename"; name: string }
  | { t: "sit"; seat: Seat }
  | { t: "stand" }
  | { t: "clearSeat"; seat: Seat }
  | { t: "start" }
  | { t: "ask"; text: string }
  | { t: "answer"; yes: boolean }
  | { t: "flip"; index: number; down: boolean }
  | { t: "guess"; index: number }
  | { t: "forfeit" }
  | { t: "rematch" }
  | { t: "lobby" }
  | { t: "react"; emoji: Reaction }

export type ServerMessage =
  | { t: "state"; room: RoomView }
  | { t: "reaction"; emoji: Reaction; from: string; name: string }
  | { t: "error"; message: string }

export const otherSeat = (seat: Seat): Seat => (seat === 0 ? 1 : 0)

export const normalizeRoomCode = (input: string): string | null => {
  const code = input.trim().toUpperCase()
  if (code.length !== ROOM_CODE_LENGTH) return null
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null
}
