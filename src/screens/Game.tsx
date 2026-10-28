import { type FormEvent, useEffect, useRef, useState } from "react"
import { type GameView, type LogEntry, MAX_QUESTION_LENGTH, type RoomView, type Seat, otherSeat } from "../../shared/protocol.ts"
import { hogImage } from "../lib/hogs.ts"
import { nameOf } from "../lib/names.ts"
import type { useRoom } from "../lib/useRoom.ts"

type Send = ReturnType<typeof useRoom>["send"]


function Tray({
  room,
  game,
  seat,
  interactive,
  guessing,
  compact,
  onTile,
}: {
  room: RoomView
  game: GameView
  seat: Seat
  interactive: boolean
  guessing: boolean
  compact: boolean
  onTile?: (index: number) => void
}) {
  const player = game.players[seat]
  const target = game.players[otherSeat(seat)].secret // the hog this board's player is hunting
  const showTarget = room.yourSeat === null || room.phase === "finished"
  const mine = room.yourSeat === seat

  return (
    <section className="tray" data-seat={seat} data-compact={compact} data-guessing={guessing} aria-label={`${nameOf(room, seat)}'s board`}>
      <div className="tray-head">
        <span className="tray-name">{mine ? "Your board" : `${nameOf(room, seat)}'s board`}</span>
        <span className="tray-count">{player.standing} left</span>
      </div>
      <div className="grid">
        {game.board.map((hog, i) => {
          const down = player.flipped[i]
          const label = guessing ? `Guess ${hog.name}` : down ? `Stand ${hog.name} back up` : `Flip down ${hog.name}`
          const content = (
            <>
              <span className="tile-art">
                <img src={hogImage(hog)} alt="" loading="eager" draggable={false} />
              </span>
              <span className="tile-name">{hog.name}</span>
            </>
          )
          return (
            <div key={`${game.round}-${hog.id}`} className="tile" data-down={down}>
              {showTarget && target === i ? <span className="tile-secret">Target</span> : null}
              {interactive ? (
                <button
                  type="button"
                  className="tile-card"
                  onClick={() => onTile?.(i)}
                  aria-label={label}
                  aria-pressed={guessing ? undefined : down}
                  disabled={guessing && down}
                >
                  {content}
                </button>
              ) : (
                <div className="tile-card" aria-label={`${hog.name}${down ? ", flipped down" : ""}`}>
                  {content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Log({ room, game }: { room: RoomView; game: GameView }) {
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" })
  }, [game.log.length, game.log.at(-1)])

  const who = (entry: LogEntry) => (room.yourSeat === entry.seat ? "You" : nameOf(room, entry.seat))

  return (
    <section className="panel log" aria-label="Questions so far">
      <div className="log-head eyebrow">Questions · {game.log.filter((e) => e.kind === "question").length}</div>
      <ol className="log-list" aria-live="polite">
        {game.log.length === 0 ? <li className="log-empty">No questions yet. Start broad: hats, glasses, food…</li> : null}
        {game.log.map((entry) => (
          <li key={entry.id} className="bubble" data-seat={entry.seat}>
            <span className="bubble-who">{who(entry)}</span>
            {entry.kind === "question" ? (
              <>
                {entry.text}
                <br />
                <span className="answer" data-yes={entry.answer === null ? "pending" : String(entry.answer)}>
                  {entry.answer === null ? "Thinking…" : entry.answer ? "Yes" : "No"}
                </span>
              </>
            ) : (
              <>
                Is it {game.board[entry.hog].name}?
                <br />
                <span className="answer" data-yes={String(entry.correct)}>
                  {entry.correct ? "Got it!" : "Nope"}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function TurnBanner({ room, game }: { room: RoomView; game: GameView }) {
  const turnName = nameOf(room, game.turn)
  const answerer = nameOf(room, otherSeat(game.turn))
  const myTurn = room.yourSeat === game.turn
  const myAnswer = room.yourSeat === otherSeat(game.turn) && game.awaitingAnswer
  let text: string
  if (room.phase === "finished") text = "Round over"
  else if (myAnswer) text = "Answer their question"
  else if (myTurn) text = game.awaitingAnswer ? `Waiting for ${answerer} to answer…` : "Your turn: ask or guess"
  else if (game.awaitingAnswer) text = `${answerer} is answering…`
  else text = `${turnName} is thinking of a question…`
  return (
    <div className="turn" data-mine={(myTurn && !game.awaitingAnswer) || myAnswer} data-seat={game.turn} aria-live="polite">
      {text}
    </div>
  )
}

/** The opponent's board seen from across the table: card backs only, but you can see which ones are down. */
function OpponentBoard({ room, game, seat }: { room: RoomView; game: GameView; seat: Seat }) {
  const player = game.players[seat]
  const name = nameOf(room, seat)
  return (
    <section className="panel opponent" aria-label={`${name}'s board from the back, ${player.standing} cards standing`}>
      <span className="eyebrow side-label">{name}'s board</span>
      <div className="mini-tray" data-seat={seat}>
        {player.flipped.map((down, i) => (
          <span key={i} className="mini-tile" data-down={down}>
            <span className="mini-card">?</span>
          </span>
        ))}
      </div>
      <span className="side-caption">{player.standing} left</span>
    </section>
  )
}

function SecretCard({ game, seat }: { game: GameView; seat: Seat }) {
  const secret = game.players[seat].secret
  if (secret === null) return null
  const hog = game.board[secret]
  return (
    <section className="panel secret" data-seat={seat}>
      <span className="eyebrow side-label">Your hog</span>
      <div className="secret-card">
        <img src={hogImage(hog)} alt="" />
      </div>
      <span className="side-caption" title={hog.name}>
        {hog.name}
      </span>
    </section>
  )
}

function Composer({
  room,
  game,
  send,
  guessing,
  setGuessing,
}: {
  room: RoomView
  game: GameView
  send: Send
  guessing: boolean
  setGuessing: (on: boolean) => void
}) {
  const [text, setText] = useState("")
  const seat = room.yourSeat!
  const opponent = otherSeat(seat)
  const last = game.log.at(-1)

  if (room.phase !== "playing") return null

  if (game.awaitingAnswer && game.turn === opponent && last?.kind === "question") {
    return (
      <section className="panel answer-pad" aria-label="Answer the question">
        <span className="eyebrow">{nameOf(room, opponent)} asks</span>
        <div className="answer-question">“{last.text}”</div>
        <div className="answer-buttons">
          <button className="btn btn-yes" onClick={() => send({ t: "answer", yes: true })}>
            Yes
          </button>
          <button className="btn btn-no" onClick={() => send({ t: "answer", yes: false })}>
            No
          </button>
        </div>
      </section>
    )
  }

  const myMove = game.turn === seat && !game.awaitingAnswer
  const ask = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    send({ t: "ask", text })
    setText("")
  }

  return (
    <section className="panel composer" aria-label="Your move">
      <form onSubmit={ask}>
        <label className="visually-hidden" htmlFor="question">
          Ask a yes-or-no question
        </label>
        <input
          id="question"
          className="input"
          value={text}
          maxLength={MAX_QUESTION_LENGTH}
          onChange={(e) => setText(e.target.value)}
          placeholder={myMove ? "Is it wearing a hat?" : "Wait for your turn…"}
          disabled={!myMove || guessing}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit" disabled={!myMove || guessing || !text.trim()}>
          Ask
        </button>
      </form>
      <div className="composer-actions">
        <button className="btn btn-small" disabled={!myMove} onClick={() => setGuessing(!guessing)} aria-pressed={guessing}>
          {guessing ? "Cancel guess" : "🎯 Make a guess"}
        </button>
        <button
          className="btn-link"
          onClick={() => {
            if (confirm("Give up this round? Your opponent wins.")) send({ t: "forfeit" })
          }}
        >
          Give up
        </button>
      </div>
    </section>
  )
}

function GuessConfirm({ game, index, onConfirm, onCancel }: { game: GameView; index: number; onConfirm: () => void; onCancel: () => void }) {
  const hog = game.board[index]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])
  return (
    <div className="backdrop" onClick={onCancel}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-labelledby="guess-title" onClick={(e) => e.stopPropagation()}>
        <div className="secret-card guess-preview">
          <img src={hogImage(hog)} alt="" />
        </div>
        <h2 id="guess-title" className="display">
          {hog.name}?
        </h2>
        <p>If you're wrong, you lose the round.</p>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel} autoFocus>
            Not yet
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            🎯 Lock it in
          </button>
        </div>
      </div>
    </div>
  )
}

export function Game({ room, send }: { room: RoomView; send: Send }) {
  const game = room.game!
  const [guessing, setGuessing] = useState(false)
  const [pendingGuess, setPendingGuess] = useState<number | null>(null)
  const seat = room.yourSeat

  const canGuess = seat !== null && room.phase === "playing" && game.turn === seat && !game.awaitingAnswer
  useEffect(() => {
    if (!canGuess) setGuessing(false)
  }, [canGuess])

  if (seat === null) {
    return (
      <main className="game" data-spectating="true">
        <Tray room={room} game={game} seat={0} interactive={false} guessing={false} compact onTile={undefined} />
        <Tray room={room} game={game} seat={1} interactive={false} guessing={false} compact onTile={undefined} />
        <aside className="side">
          <TurnBanner room={room} game={game} />
          <Log room={room} game={game} />
        </aside>
      </main>
    )
  }

  const onTile = (index: number) => {
    if (room.phase !== "playing") return
    if (guessing) return setPendingGuess(index)
    send({ t: "flip", index, down: !game.players[seat].flipped[index] })
  }

  return (
    <main className="game">
      <div className="board-wrap">
        <Tray room={room} game={game} seat={seat} interactive={room.phase === "playing"} guessing={guessing} compact={false} onTile={onTile} />
        <p className="tray-hint">{guessing ? "Tap the hog you think they picked." : "Tap a hog to flip it down. Tap again to stand it back up."}</p>
      </div>
      <aside className="side">
        <div className="side-top">
          <SecretCard game={game} seat={seat} />
          <OpponentBoard room={room} game={game} seat={otherSeat(seat)} />
        </div>
        <TurnBanner room={room} game={game} />
        <Log room={room} game={game} />
        <Composer room={room} game={game} send={send} guessing={guessing} setGuessing={setGuessing} />
      </aside>
      {pendingGuess !== null ? (
        <GuessConfirm
          game={game}
          index={pendingGuess}
          onCancel={() => setPendingGuess(null)}
          onConfirm={() => {
            send({ t: "guess", index: pendingGuess })
            setPendingGuess(null)
            setGuessing(false)
          }}
        />
      ) : null}
    </main>
  )
}
