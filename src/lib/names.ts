import type { RoomView, Seat } from "../../shared/protocol.ts"

export const nameOf = (room: RoomView, seat: Seat) => room.members.find((m) => m.id === room.seats[seat])?.name ?? `Player ${seat + 1}`
