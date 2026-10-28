// Little synthesized chimes for game events, so there are no audio files to load. Browsers only
// let a page make sound after a user gesture, so the AudioContext is created on the first click.

const MUTE_KEY = "guesshog:muted"
let ctx: AudioContext | null = null

export const isMuted = () => localStorage.getItem(MUTE_KEY) === "1"
export const setMuted = (muted: boolean) => localStorage.setItem(MUTE_KEY, muted ? "1" : "0")

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Create the AudioContext inside the first user gesture so later sounds are allowed to play. */
export function unlockAudioOnFirstGesture() {
  const unlock = () => {
    audio()
    window.removeEventListener("pointerdown", unlock)
    window.removeEventListener("keydown", unlock)
  }
  window.addEventListener("pointerdown", unlock)
  window.addEventListener("keydown", unlock)
}

/** Play a sequence of notes (Hz), each `step` seconds apart. */
function notes(freqs: number[], step: number, { type = "triangle" as OscillatorType, volume = 0.16, length = 0.28 } = {}) {
  if (isMuted()) return
  const ac = audio()
  if (!ac) return
  const start = ac.currentTime + 0.02
  freqs.forEach((freq, i) => {
    const at = start + i * step
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(volume, at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    osc.connect(gain).connect(ac.destination)
    osc.start(at)
    osc.stop(at + length + 0.05)
  })
}

export const sounds = {
  /** The other player asked you a question: your move. */
  question: () => notes([784, 988, 1175, 988], 0.11, { volume: 0.2 }),
  /** Your question was answered. */
  yes: () => notes([659, 988], 0.1),
  no: () => notes([494, 370], 0.12),
  /** A new round was dealt. */
  deal: () => notes([523, 587, 659, 698, 784], 0.045, { volume: 0.1, length: 0.12 }),
  /** You go first. */
  yourTurn: () => notes([880, 1175], 0.12, { volume: 0.18 }),
  win: () => notes([523, 659, 784, 1047, 1319], 0.1, { volume: 0.18, length: 0.4 }),
  lose: () => notes([392, 349, 311, 262], 0.16, { type: "sine", volume: 0.18, length: 0.4 }),
}
