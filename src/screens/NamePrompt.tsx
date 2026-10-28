import { useState } from "react"
import { MAX_NAME_LENGTH } from "../../shared/protocol.ts"
import { CodeDisplay } from "../components/CodeTiles.tsx"
import { GuessHogLogo } from "../components/Logo.tsx"
import { randomName, saveName } from "../lib/identity.ts"

/** Shown when someone opens an invite link before we know what to call them. */
export function NamePrompt({ code, onDone }: { code: string; onDone: () => void }) {
  const [name, setName] = useState(randomName)
  return (
    <main className="home">
      <div className="home-stack">
        <GuessHogLogo />
        <form
          className="panel home-panel"
          style={{ alignItems: "center", textAlign: "center" }}
          onSubmit={(e) => {
            e.preventDefault()
            saveName(name.trim() || randomName())
            onDone()
          }}
        >
          <span className="eyebrow">You're invited to room</span>
          <CodeDisplay code={code} size={52} />
          <label className="field" style={{ width: "100%", textAlign: "left" }}>
            <span className="eyebrow">Your name</span>
            <span className="input-row">
              <input className="input" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} autoFocus />
              <button type="button" className="btn btn-small" style={{ minHeight: 52 }} onClick={() => setName(randomName())} aria-label="Pick a random name">
                🎲
              </button>
            </span>
          </label>
          <button type="submit" className="btn btn-primary btn-big" style={{ width: "100%" }}>
            Join the room
          </button>
        </form>
      </div>
    </main>
  )
}
