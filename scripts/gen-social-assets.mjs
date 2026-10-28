// Generates the social card (public/og.png) and the app icons into public/.
//
// The card is scripts/social/og.html, screenshotted in headless Chrome so it uses the real
// RoundHog font, brand colours and hoggies. The icons are rasterised from public/favicon.svg.
// The output is committed: it changes rarely and the dev server needs it too. Re-run with
// `pnpm gen:social` after changing the card or the favicon. Needs Google Chrome installed.
import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { Logo } from "@posthog/brand/logo"
import { chromium } from "playwright-core"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import sharp from "sharp"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const pub = (name) => join(root, "public", name)
const BLUE = "#1490E8"

// A board mid-game: twelve hogs, a few already flipped down.
const CARDS = [
  ["chef", "Chef"],
  ["angel", "Angel"],
  ["dj", "DJ", true],
  ["explorer", "Explorer"],
  ["gatsby", "Gatsby"],
  ["surfer", "Surfer", true],
  ["katy-perry", "Katy Perry"],
  ["noir-1", "Noir"],
  ["football-player", "Football", true],
  ["party", "Party"],
  ["cool-car", "Cool Car", true],
  ["traffic-police", "Traffic Police"],
]
const BACKS_DOWN = new Set([1, 4, 5, 9, 14, 17, 20, 22])

async function renderCard() {
  const rootUrl = pathToFileURL(root).href
  const cards = CARDS.map(
    ([id, name, down]) =>
      `<div class="card${down ? " down" : ""}"><div class="face"><div class="art"><img src="${rootUrl}/public/hoggies/${id}.webp" alt="" /></div><div class="name">${name}</div></div></div>`,
  ).join("")
  const backs = Array.from({ length: 24 }, (_, i) => `<span${BACKS_DOWN.has(i) ? ' class="down"' : ""}></span>`).join("")
  const html = readFileSync(join(root, "scripts", "social", "og.html"), "utf8")
    .replaceAll("{{ROOT}}", rootUrl)
    .replaceAll("{{POSTHOG_LOGO}}", renderToStaticMarkup(createElement(Logo)))
    .replaceAll("{{CARDS}}", cards)
    .replaceAll("{{BACKS}}", backs)

  const page = join(tmpdir(), "guesshog-og.html")
  writeFileSync(page, html)
  const browser = await chromium.launch({ channel: "chrome", headless: true })
  try {
    const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
    await tab.goto(pathToFileURL(page).href)
    await tab.evaluate(() => document.fonts.ready)
    await tab.waitForLoadState("networkidle")
    const png = await tab.screenshot({ type: "png" })
    await sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(pub("og.png"))
  } finally {
    await browser.close()
  }
}

/** Pack PNG frames into a .ico (PNG-in-ICO, supported everywhere that still asks for one). */
function ico(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = 6 + frames.length * 16
  const entries = frames.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size, 0)
    entry.writeUInt8(size, 1)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.png)])
}

async function renderIcons() {
  const svg = readFileSync(pub("favicon.svg"))
  const icon = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()
  /** The icon centred on a solid brand-blue square, for launchers that don't do transparency. */
  const onBlue = async (size, scale) => {
    const inner = await icon(Math.round(size * scale))
    return sharp({ create: { width: size, height: size, channels: 4, background: BLUE } })
      .composite([{ input: inner, gravity: "center" }])
      .png()
      .toBuffer()
  }

  writeFileSync(pub("favicon-96x96.png"), await icon(96))
  writeFileSync(pub("icon-192.png"), await icon(192))
  writeFileSync(pub("icon-512.png"), await icon(512))
  writeFileSync(pub("apple-touch-icon.png"), await onBlue(180, 0.72))
  writeFileSync(pub("icon-maskable-512.png"), await onBlue(512, 0.6))
  writeFileSync(pub("favicon.ico"), ico([{ size: 32, png: await icon(32) }, { size: 48, png: await icon(48) }]))
}

await renderCard()
await renderIcons()
console.log("🦔 wrote public/og.png and the app icons")
