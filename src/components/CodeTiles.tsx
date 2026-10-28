import { type ClipboardEvent, type KeyboardEvent, useRef } from "react"
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../../shared/protocol.ts"

export function CodeDisplay({ code, size = 56 }: { code: string; size?: number }) {
  return (
    <span className="code-tiles" style={{ ["--tile" as string]: `${size}px` }} aria-label={`Room code ${code.split("").join(" ")}`}>
      {code.split("").map((char, i) => (
        <span key={i} className="code-tile" aria-hidden="true">
          {char}
        </span>
      ))}
    </span>
  )
}

const clean = (text: string) =>
  text
    .toUpperCase()
    .split("")
    .filter((c) => ROOM_CODE_ALPHABET.includes(c))
    .join("")

/** Four letter tiles you type a room code into. Typing, backspace and paste hop between tiles. */
export function CodeInput({ value, onChange, onSubmit }: { value: string; onChange: (code: string) => void; onSubmit: () => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (value[i] ?? "").trim())

  const setAt = (index: number, char: string) => {
    const next = [...chars]
    next[index] = char
    // Empty tiles are kept as spaces so letters stay in the tile they were typed into.
    onChange(next.map((c) => c || " ").join("").trimEnd())
  }

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") return onSubmit()
    if (event.key === "Backspace" && !chars[index] && index > 0) {
      setAt(index - 1, "")
      refs.current[index - 1]?.focus()
      event.preventDefault()
    } else if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus()
    else if (event.key === "ArrowRight" && index < ROOM_CODE_LENGTH - 1) refs.current[index + 1]?.focus()
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = clean(event.clipboardData.getData("text")).slice(0, ROOM_CODE_LENGTH)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    refs.current[Math.min(pasted.length, ROOM_CODE_LENGTH - 1)]?.focus()
  }

  return (
    <span className="code-tiles" style={{ ["--tile" as string]: "52px" }} role="group" aria-label="Room code">
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => void (refs.current[i] = el)}
          className="code-tile"
          value={char}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={2}
          aria-label={`Letter ${i + 1}`}
          onChange={(e) => {
            const typed = clean(e.target.value).slice(-1)
            setAt(i, typed)
            if (typed && i < ROOM_CODE_LENGTH - 1) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </span>
  )
}
