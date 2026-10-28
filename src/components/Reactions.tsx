import { type Reaction, REACTIONS } from "../../shared/protocol.ts"
import type { FloatingReaction } from "../lib/useRoom.ts"

export function ReactionBar({ onReact, mobile = false }: { onReact: (emoji: Reaction) => void; mobile?: boolean }) {
  return (
    <div className="reaction-bar" data-mobile={mobile} role="group" aria-label="Send a reaction">
      {REACTIONS.map((emoji) => (
        <button key={emoji} type="button" onClick={() => onReact(emoji)} aria-label={`React with ${emoji}`}>
          {emoji}
        </button>
      ))}
    </div>
  )
}

export function Floaters({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="floaters" aria-hidden="true">
      {reactions.map((r) => {
        const left = 8 + ((r.key * 37) % 84)
        const drift = ((r.key * 53) % 120) - 60
        return (
          <div key={r.key} className="floater" style={{ left: `${left}%`, ["--drift" as string]: `${drift}px` }}>
            <span className="floater-emoji">{r.emoji}</span>
            <span className="floater-name">{r.mine ? "You" : r.name}</span>
          </div>
        )
      })}
    </div>
  )
}
