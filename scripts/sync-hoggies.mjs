// Builds the GuessHog deck from @posthog/brand: every solo hoggie becomes a
// card. Writes the card list to shared/hoggies.json (used by the worker to deal
// boards) and a resized WebP of each hoggie to public/hoggies/ (used by the UI).
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { assets } from "@posthog/brand/hoggies/metadata"
import sharp from "sharp"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "public", "hoggies")
const CARD_SIZE = 360

const isSolo = (meta) => {
  const tags = (meta.tags ?? []).map((t) => t.toLowerCase())
  return tags.includes("solo") && !tags.includes("group")
}

const hogs = assets.filter(isSolo).map((meta) => {
  const variant = meta.variant?.variant
  return {
    id: variant ? `${meta.slug}-${variant}` : meta.slug,
    name: variant ? `${meta.name} ${variant}` : meta.name,
  }
})

mkdirSync(outDir, { recursive: true })
let written = 0
for (const hog of hogs) {
  const target = join(outDir, `${hog.id}.webp`)
  if (existsSync(target)) continue
  const { src } = await import(`@posthog/brand/hoggies/png/${hog.id}`)
  await sharp(fileURLToPath(src))
    .resize(CARD_SIZE, CARD_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(target)
  written++
}

mkdirSync(join(root, "shared"), { recursive: true })
writeFileSync(join(root, "shared", "hoggies.json"), JSON.stringify(hogs, null, 2) + "\n")
console.log(`🦔 ${hogs.length} solo hoggies in the deck (${written} images written)`)
