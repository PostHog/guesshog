import type { Hog } from "../../shared/protocol.ts"

export const hogImage = (hog: Pick<Hog, "id">) => `/hoggies/${hog.id}.webp`
