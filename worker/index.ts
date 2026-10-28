import { normalizeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../shared/protocol.ts"

export { GameRoom } from "./room.ts"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function randomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("")
}

const room = (env: Env, code: string) => env.ROOMS.get(env.ROOMS.idFromName(code))

/** Swaps an element's `content` attribute, for rewriting meta tags. */
const setContent = (value: string) => ({ element: (el: Element) => void el.setAttribute("content", value) })

/**
 * Invite links (`/r/CODE`) get the app's index.html with a title and description about the room,
 * so they unfurl as an invitation in Slack, iMessage, and other chat apps. Room pages are
 * short-lived, so they're kept out of search results.
 */
async function invitePage(request: Request, env: Env, code: string): Promise<Response> {
  const index = await env.ASSETS.fetch(new URL("/", request.url))
  const title = `Join my GuessHog room: ${code}`
  const description = "You're invited to a game of Guess Who with PostHog hedgehogs. Take a seat or watch from the stands."
  const url = new URL(`/r/${code}`, request.url).href
  const response = new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(`${title} · GuessHog`) })
    .on('meta[name="description"]', setContent(description))
    .on('meta[name="robots"]', setContent("noindex, follow"))
    .on('meta[property="og:title"], meta[name="twitter:title"]', setContent(title))
    .on('meta[property="og:description"], meta[name="twitter:description"]', setContent(description))
    .on('meta[property="og:url"]', setContent(url))
    .transform(index)
  const headers = new Headers(response.headers)
  headers.set("X-Robots-Tag", "noindex")
  return new Response(response.body, { status: index.status, headers })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomCode()
        if (await room(env, code).create(code)) return json({ code }, 201)
      }
      return json({ error: "Couldn't find a free room code. Try again." }, 503)
    }

    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/ws)?$/)
    if (match) {
      const code = normalizeRoomCode(match[1])
      if (!code) return json({ error: "Room codes are four letters." }, 400)
      if (match[2]) return room(env, code).fetch(request)
      return json({ code, exists: await room(env, code).exists() })
    }

    const invite = url.pathname.match(/^\/r\/([^/]+)\/?$/)
    if (invite) {
      const code = normalizeRoomCode(invite[1])
      if (code) return invitePage(request, env, code)
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
