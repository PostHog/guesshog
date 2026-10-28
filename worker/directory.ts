import { DurableObject } from "cloudflare:workers"
import type { LiveRoom } from "../shared/protocol.ts"

/** How many rooms the home page lists. */
const LIST_LIMIT = 12
/** Drop entries a room hasn't refreshed in this long, in case it went away without saying so. */
const STALE_MS = 6 * 60 * 60 * 1000

/**
 * A single Durable Object that knows which rooms have people in them, so the home page can
 * list live games. Each GameRoom reports a small summary whenever it changes and removes
 * itself when the last person leaves.
 */
export class RoomDirectory extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, summary TEXT NOT NULL, updated_at INTEGER NOT NULL)",
    )
  }

  async update(room: LiveRoom): Promise<void> {
    this.ctx.storage.sql.exec(
      "INSERT INTO rooms (code, summary, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET summary = excluded.summary, updated_at = excluded.updated_at",
      room.code,
      JSON.stringify(room),
      room.updatedAt,
    )
  }

  async remove(code: string): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM rooms WHERE code = ?", code)
  }

  async list(): Promise<LiveRoom[]> {
    this.ctx.storage.sql.exec("DELETE FROM rooms WHERE updated_at < ?", Date.now() - STALE_MS)
    return this.ctx.storage.sql
      .exec<{ summary: string }>("SELECT summary FROM rooms ORDER BY updated_at DESC LIMIT ?", LIST_LIMIT)
      .toArray()
      .map((row) => JSON.parse(row.summary) as LiveRoom)
  }
}
