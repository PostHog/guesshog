import type { RoomView, Seat } from "../../shared/protocol.ts"
import { otherSeat } from "../../shared/protocol.ts"
import { hogImage } from "../lib/hogs.ts"
import type { useRoom } from "../lib/useRoom.ts"
import { nameOf } from "../lib/names.ts"

type Send = ReturnType<typeof useRoom>["send"]

export function Finished({ room, send, onClose }: { room: RoomView; send: Send; onClose: () => void }) {
  const game = room.game!
  const winner = game.winner as Seat
  const loser = otherSeat(winner)
  const winnerName = nameOf(room, winner)
  const loserName = nameOf(room, loser)
  const guess = game.log.findLast((e) => e.kind === "guess")
  const hogName = (seat: Seat) => game.board[game.players[seat].secret!].name

  const title = room.yourSeat === null ? `${winnerName} wins!` : room.yourSeat === winner ? "You win!" : "Busted!"
  let reason = ""
  if (game.endReason === "guess") reason = `${winnerName} found ${hogName(loser)}.`
  else if (game.endReason === "wrong-guess" && guess) reason = `${loserName} guessed ${game.board[guess.hog].name}, but it was ${hogName(winner)}.`
  else if (game.endReason === "forfeit") reason = `${loserName} gave up.`

  const bothHere = room.seats.every((id) => room.members.find((m) => m.id === id)?.online)

  return (
    <div className="backdrop">
      <div className="panel modal" role="dialog" aria-modal="true" aria-labelledby="finished-title">
        <h2 id="finished-title" className="display">
          {title}
        </h2>
        <p>{reason}</p>
        <div className="reveal">
          {([0, 1] as Seat[]).map((seat) => {
            const hog = game.board[game.players[seat].secret!]
            return (
              <div key={seat} className="reveal-card" data-seat={seat}>
                <div className="secret-card">
                  <img src={hogImage(hog)} alt="" />
                </div>
                <strong>{hog.name}</strong>
                <span className="reveal-owner">{room.yourSeat === seat ? "Your hog" : `${nameOf(room, seat)}'s hog`}</span>
              </div>
            )
          })}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary btn-big" disabled={!bothHere} onClick={() => send({ t: "rematch" })}>
            Rematch
          </button>
          <button className="btn btn-big" onClick={() => send({ t: "lobby" })}>
            Back to lobby
          </button>
        </div>
        <button className="btn-link" onClick={onClose}>
          See the boards
        </button>
      </div>
    </div>
  )
}
