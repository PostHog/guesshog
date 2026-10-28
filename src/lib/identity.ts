import { MAX_NAME_LENGTH } from "../../shared/protocol.ts"

const PID_KEY = "guesshog:pid"
const NAME_KEY = "guesshog:name"

const ADJECTIVES = ["Prickly", "Spiky", "Bristly", "Snuffly", "Curled-up", "Hibernating", "Quilly", "Snoozy", "Nocturnal", "Sniffly", "Huffy", "Hedgerow"]
const NOUNS = ["Hoglet", "Quill", "Urchin", "Hedgepig", "Spikeball", "Snuffler", "Pincushion", "Prickleback", "Furze-pig", "Hogling", "Quillster", "Thornball"]

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

export const randomName = () => `${pick(ADJECTIVES)} ${pick(NOUNS)}`

export function playerId(): string {
  let pid = localStorage.getItem(PID_KEY)
  if (!pid) {
    pid = crypto.randomUUID()
    localStorage.setItem(PID_KEY, pid)
  }
  return pid
}

export function savedName(): string {
  return localStorage.getItem(NAME_KEY) ?? ""
}

export function saveName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, MAX_NAME_LENGTH))
}
