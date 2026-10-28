import { useEffect, useRef } from "react"
import { otherSeat, type RoomView } from "../../shared/protocol.ts"
import { sounds } from "./sound.ts"

interface Snapshot {
  round: number
  phase: RoomView["phase"]
  lastId: number
  lastAnswered: boolean
}

/** Plays a sound when something happens that the viewer should notice, comparing each update to the last. */
export function useGameSounds(room: RoomView | null) {
  const previous = useRef<Snapshot | null>(null)

  useEffect(() => {
    if (!room) return
    const game = room.game
    if (!game) {
      // In the lobby: remember that, so the first deal counts as new.
      previous.current = { round: 0, phase: room.phase, lastId: 0, lastAnswered: true }
      return
    }
    const last = game.log.at(-1)
    const now: Snapshot = {
      round: game.round,
      phase: room.phase,
      lastId: last?.id ?? 0,
      lastAnswered: last?.kind === "question" ? last.answer !== null : true,
    }
    const before = previous.current
    previous.current = now
    if (!before) return // first state after (re)connecting: nothing new happened

    const seat = room.yourSeat
    if (now.round !== before.round) {
      sounds.deal()
      if (seat !== null && game.turn === seat) setTimeout(sounds.yourTurn, 450)
      return
    }
    if (now.phase === "finished" && before.phase === "playing") {
      if (seat === null || game.winner === seat) sounds.win()
      else sounds.lose()
      return
    }
    if (seat === null || !last || last.kind !== "question") return
    if (now.lastId !== before.lastId && last.answer === null && last.seat === otherSeat(seat)) sounds.question()
    else if (now.lastId === before.lastId && now.lastAnswered && !before.lastAnswered && last.seat === seat) {
      if (last.answer) sounds.yes()
      else sounds.no()
    }
  }, [room])
}
