import { useEffect, useRef, useState } from "react"
import { otherSeat } from "../../shared/protocol.ts"
import { Finished } from "../components/Finished.tsx"
import { GuessHogLogo } from "../components/Logo.tsx"
import { Floaters, ReactionBar } from "../components/Reactions.tsx"
import { Toast } from "../components/Toast.tsx"
import { celebrate } from "../lib/celebrate.ts"
import { playerId, savedName } from "../lib/identity.ts"
import { isMuted, setMuted, sounds } from "../lib/sound.ts"
import { useGameSounds } from "../lib/useGameSounds.ts"
import { useRoom } from "../lib/useRoom.ts"
import { Game } from "./Game.tsx"
import { Lobby } from "./Lobby.tsx"

export function Room({ code, onLeave }: { code: string; onLeave: (error?: string) => void }) {
  const [pid] = useState(playerId)
  const { room, status, reactions, error, send } = useRoom(code, pid, savedName())
  const [notice, setNotice] = useState<{ key: number; message: string } | null>(null)
  const [showResults, setShowResults] = useState(true)
  const lastPhase = useRef(room?.phase)
  const [muted, setMutedState] = useState(isMuted)
  useGameSounds(room)

  const toggleSound = () => {
    setMuted(!muted)
    setMutedState(!muted)
    if (muted) sounds.yourTurn() // play a sample when sound comes back on
  }

  useEffect(() => setNotice(error), [error])

  useEffect(() => {
    if (status === "missing") onLeave(`There's no room ${code}. It may have expired after a while with nobody in it.`)
  }, [status, code, onLeave])

  // Celebrate when a round ends, and reopen the results for the next one.
  useEffect(() => {
    if (!room) return
    if (room.phase === "finished" && lastPhase.current === "playing") {
      celebrate(room.yourSeat === null || room.game?.winner === room.yourSeat)
      setShowResults(true)
    }
    lastPhase.current = room.phase
  }, [room])

  // Put a nudge in the tab title when the game is waiting on you.
  useEffect(() => {
    const game = room?.game
    const seat = room?.yourSeat
    let waiting = false
    if (room?.phase === "playing" && game && seat !== null && seat !== undefined) {
      waiting = game.awaitingAnswer ? game.turn === otherSeat(seat) : game.turn === seat
    }
    document.title = waiting ? "🦔 Your move · GuessHog" : `${code} · GuessHog`
    return () => void (document.title = "GuessHog: Guess Who, with hedgehogs")
  }, [room, code])

  const copyLink = async () => {
    const url = `${location.origin}/r/${code}`
    try {
      await navigator.clipboard.writeText(url)
      setNotice({ key: Date.now(), message: "Invite link copied. Send it to a friend." })
    } catch {
      setNotice({ key: Date.now(), message: url })
    }
  }

  return (
    <>
      <header className="topbar">
        <GuessHogLogo onHome={() => onLeave()} />
        <div className="topbar-right">
          {room && room.phase !== "lobby" ? (
            <button className="room-badge" onClick={copyLink} title="Copy invite link">
              <span className="code">{code}</span>
              <span className="btn btn-small" style={{ boxShadow: "none" }}>
                🔗
              </span>
            </button>
          ) : null}
          <button className="sound-toggle" onClick={toggleSound} aria-pressed={!muted} title={muted ? "Turn sounds on" : "Turn sounds off"}>
            <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
            <span className="visually-hidden">Sounds</span>
          </button>
          <ReactionBar onReact={(emoji) => send({ t: "react", emoji })} />
        </div>
      </header>

      {status === "reconnecting" ? <div className="connection">Reconnecting…</div> : null}

      {!room ? (
        <main className="center-screen">
          <div className="panel status-card">
            <img src="/hoggies/magnifying-glass.webp" alt="" />
            <h2>Finding room {code}…</h2>
          </div>
        </main>
      ) : room.phase === "lobby" ? (
        <Lobby room={room} send={send} onCopyLink={copyLink} />
      ) : (
        <>
          <Game room={room} send={send} />
          {room.phase === "finished" && showResults ? <Finished room={room} send={send} onClose={() => setShowResults(false)} /> : null}
          {room.phase === "finished" && !showResults ? (
            <button className="btn btn-primary connection" style={{ minHeight: 0 }} onClick={() => setShowResults(true)}>
              Show results
            </button>
          ) : null}
        </>
      )}

      <div style={{ position: "fixed", bottom: 12, left: 12, right: 12, zIndex: 30, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }} className="mobile-reactions">
          <ReactionBar mobile onReact={(emoji) => send({ t: "react", emoji })} />
        </div>
      </div>
      <Floaters reactions={reactions} />
      <Toast notice={notice} />
    </>
  )
}
