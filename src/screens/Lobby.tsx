import { useState } from "react"
import { MAX_NAME_LENGTH, type MemberView, type RoomView, type Seat } from "../../shared/protocol.ts"
import { CodeDisplay } from "../components/CodeTiles.tsx"
import { avatarFor } from "../lib/avatar.ts"
import { saveName as rememberName } from "../lib/identity.ts"
import type { useRoom } from "../lib/useRoom.ts"

type Send = ReturnType<typeof useRoom>["send"]

function SeatCard({ seat, room, send }: { seat: Seat; room: RoomView; send: Send }) {
  const occupant = room.members.find((m) => m.id === room.seats[seat])
  const mine = room.yourSeat === seat
  return (
    <section className="seat" data-seat={seat} aria-label={`Player ${seat + 1} seat`}>
      <span className="seat-label">Player {seat + 1}</span>
      {occupant ? (
        <>
          <div className="avatar">
            <img src={avatarFor(occupant.id)} alt="" />
          </div>
          <div className="seat-name">{mine ? `${occupant.name} (you)` : occupant.name}</div>
          <div className="seat-meta">
            <span className="dot" data-online={occupant.online} />
            {occupant.online ? "Ready" : "Left the room"}
            {occupant.wins > 0 ? ` · ${occupant.wins} ${occupant.wins === 1 ? "win" : "wins"}` : ""}
          </div>
          {mine ? (
            <button className="btn btn-small" onClick={() => send({ t: "stand" })}>
              Leave seat
            </button>
          ) : !occupant.online ? (
            <button className="btn btn-small" onClick={() => send({ t: "clearSeat", seat })}>
              Free this seat
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div className="seat-empty">?</div>
          <div className="seat-name">Empty seat</div>
          <button className="btn btn-primary" onClick={() => send({ t: "sit", seat })}>
            {room.yourSeat === null ? "Sit here" : "Switch here"}
          </button>
        </>
      )}
    </section>
  )
}

function MemberChip({ member, you }: { member: MemberView; you: boolean }) {
  return (
    <span className="chip">
      <img src={avatarFor(member.id)} alt="" width={26} height={26} style={{ borderRadius: "50%", background: "var(--lemon-light)" }} />
      {member.name}
      {you ? " (you)" : ""}
      {member.wins > 0 ? <span className="muted">· {member.wins}🏆</span> : null}
    </span>
  )
}

export function Lobby({ room, send, onCopyLink }: { room: RoomView; send: Send; onCopyLink: () => void }) {
  const me = room.members.find((m) => m.id === room.you)
  const [name, setName] = useState(me?.name ?? "")
  const spectators = room.members.filter((m) => m.seat === null && m.online)
  const seated = room.seats.map((id) => room.members.find((m) => m.id === id))
  const ready = seated.every((m) => m?.online)

  const saveName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== me?.name) {
      send({ t: "rename", name: trimmed })
      rememberName(trimmed)
    }
  }

  return (
    <main className="lobby">
      <header className="lobby-head">
        <span className="eyebrow">Room code</span>
        <CodeDisplay code={room.code} size={52} />
        <button className="btn btn-small" onClick={onCopyLink}>
          🔗 Copy invite link
        </button>
      </header>

      <div className="seats">
        <SeatCard seat={0} room={room} send={send} />
        <div className="vs display">VS</div>
        <SeatCard seat={1} room={room} send={send} />
      </div>

      <div className="lobby-actions">
        <button className="btn btn-primary btn-big" disabled={!ready} onClick={() => send({ t: "start" })}>
          🃏 Deal the cards
        </button>
        <span className="tagline" style={{ fontSize: 16 }}>
          {ready ? "Anyone in the room can deal." : "Two players need to take a seat."}
        </span>
      </div>

      <section className="panel stands" aria-label="Spectators">
        <span className="eyebrow">In the stands · {spectators.length}</span>
        {spectators.length > 0 ? (
          <div className="stands-list">
            {spectators.map((m) => (
              <MemberChip key={m.id} member={m} you={m.id === room.you} />
            ))}
          </div>
        ) : (
          <span className="muted" style={{ fontWeight: 700 }}>
            No one's watching yet. Spectators see both boards and both secret hogs.
          </span>
        )}
        <form
          className="you-row"
          style={{ justifyContent: "flex-start", marginTop: 6 }}
          onSubmit={(e) => {
            e.preventDefault()
            saveName()
          }}
        >
          <label className="visually-hidden" htmlFor="rename">
            Your name
          </label>
          <input id="rename" className="input" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
          <button className="btn btn-small" type="submit" disabled={!name.trim() || name.trim() === me?.name}>
            Rename
          </button>
        </form>
      </section>
    </main>
  )
}
