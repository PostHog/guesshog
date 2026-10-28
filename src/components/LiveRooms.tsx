import { useEffect, useState } from "react"
import type { LiveRoom } from "../../shared/protocol.ts"

const POLL_MS = 5000

function describe(room: LiveRoom) {
  const [one, two] = room.players
  const matchup = one && two ? `${one} vs ${two}` : one || two ? `${one ?? two} needs an opponent` : "Two empty seats"
  const watching = room.spectators > 0 ? ` · ${room.spectators} watching` : ""
  const status = room.phase === "playing" ? "Playing" : room.phase === "finished" ? "Round over" : "In the lobby"
  const canSit = room.phase === "lobby" && !(one && two)
  return { matchup, status: status + watching, action: canSit ? "Join" : "Watch" }
}

/** Rooms with people in them right now, refreshed every few seconds while the tab is visible. */
export function LiveRooms({ onEnter }: { onEnter: (code: string) => void }) {
  const [rooms, setRooms] = useState<LiveRoom[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (document.hidden) return
      try {
        const res = await fetch("/api/rooms")
        const body = (await res.json()) as { rooms: LiveRoom[] }
        if (!cancelled) setRooms(body.rooms)
      } catch {
        // keep showing the last list; the next poll will try again
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    document.addEventListener("visibilitychange", load)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", load)
    }
  }, [])

  if (rooms === null) return null

  return (
    <section className="panel live" aria-label="Live rooms">
      <div className="live-head">
        <span className="live-dot" aria-hidden="true" />
        <span className="eyebrow">Live rooms · {rooms.length}</span>
      </div>
      {rooms.length === 0 ? (
        <p className="live-empty">No games right now. Create a room and invite a friend.</p>
      ) : (
        <ul className="live-list">
          {rooms.map((room) => {
            const { matchup, status, action } = describe(room)
            return (
              <li key={room.code}>
                <button type="button" className="live-room" onClick={() => onEnter(room.code)} aria-label={`${action} room ${room.code}: ${matchup}, ${status}`}>
                  <span className="live-code">{room.code}</span>
                  <span className="live-info">
                    <span className="live-matchup">{matchup}</span>
                    <span className="live-status" data-phase={room.phase}>
                      {status}
                    </span>
                  </span>
                  <span className="btn btn-small" aria-hidden="true">
                    {action}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
