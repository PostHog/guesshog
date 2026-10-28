import { type FormEvent, useState } from "react"
import { MAX_NAME_LENGTH, normalizeRoomCode } from "../../shared/protocol.ts"
import { CodeInput } from "../components/CodeTiles.tsx"
import { LiveRooms } from "../components/LiveRooms.tsx"
import { GuessHogLogo } from "../components/Logo.tsx"
import { randomName, saveName, savedName } from "../lib/identity.ts"

export function Home({ onEnterRoom, initialError }: { onEnterRoom: (code: string) => void; initialError?: string }) {
  const [name, setName] = useState(() => savedName() || randomName())
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState<"create" | "join" | null>(null)
  const [error, setError] = useState(initialError ?? "")

  const remember = () => saveName(name.trim() || randomName())

  const create = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy("create")
    setError("")
    remember()
    try {
      const res = await fetch("/api/rooms", { method: "POST" })
      const body = (await res.json()) as { code?: string; error?: string }
      if (!body.code) throw new Error(body.error)
      onEnterRoom(body.code)
    } catch (e) {
      setError((e as Error).message || "Couldn't create a room. Check your connection and try again.")
      setBusy(null)
    }
  }

  const join = async () => {
    const normalized = normalizeRoomCode(code)
    if (!normalized) return setError("Room codes are four letters.")
    setBusy("join")
    setError("")
    remember()
    try {
      const res = await fetch(`/api/rooms/${normalized}`)
      const body = (await res.json()) as { exists?: boolean }
      if (!body.exists) {
        setError(`There's no room ${normalized}. Check the code with whoever invited you.`)
        setBusy(null)
        return
      }
      onEnterRoom(normalized)
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
      setBusy(null)
    }
  }

  return (
    <>
      <main className="home">
        <div className="home-stack">
          <GuessHogLogo />
          <p className="tagline">Guess Who, but every face is a hedgehog. Ask yes-or-no questions and find their hog first.</p>

          <form className="panel home-panel" onSubmit={create}>
            <label className="field">
              <span className="eyebrow">Your name</span>
              <span className="input-row">
                <input
                  className="input"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Prickly Hoglet"
                />
                <button type="button" className="btn btn-small" style={{ minHeight: 52 }} onClick={() => setName(randomName())} aria-label="Pick a random name" title="Pick a random name">
                  🎲
                </button>
              </span>
            </label>

            <button type="submit" className="btn btn-primary btn-big" disabled={busy !== null}>
              {busy === "create" ? <span className="spin">🦔</span> : null}
              Create a room
            </button>

            <div className="or">or join a friend</div>

            <div className="join-row">
              <CodeInput value={code} onChange={setCode} onSubmit={join} />
              <button type="button" className="btn" onClick={join} disabled={busy !== null || !normalizeRoomCode(code)}>
                {busy === "join" ? <span className="spin">🦔</span> : null}
                Join
              </button>
            </div>

            {error ? (
              <p role="alert" style={{ margin: 0, fontWeight: 700, color: "var(--coral-dark)" }}>
                {error}
              </p>
            ) : null}
          </form>

          <LiveRooms
            onEnter={(liveCode) => {
              remember()
              onEnterRoom(liveCode)
            }}
          />

          <ol className="how">
            <li>
              <b>Grab seats</b>Two players sit down. Everyone else watches from the stands.
            </li>
            <li>
              <b>Ask away</b>Take turns asking yes-or-no questions and flip down the hogs it can't be.
            </li>
            <li>
              <b>Call it</b>Think you know? Guess their hog. Wrong guesses lose, so be sure.
            </li>
          </ol>
        </div>
      </main>
    </>
  )
}
