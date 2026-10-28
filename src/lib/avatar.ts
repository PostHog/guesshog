import deck from "../../shared/hoggies.json"
import type { Hog } from "../../shared/protocol.ts"
import { hogImage } from "./hogs.ts"

/** Everyone in a room gets a hoggie avatar, picked from their player id so it stays the same. */
export function avatarFor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  const hogs = deck as Hog[]
  return hogImage(hogs[Math.abs(hash) % hogs.length])
}
