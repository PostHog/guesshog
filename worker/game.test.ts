import assert from "node:assert/strict"
import { test } from "node:test"
import type { ClientMessage, Hog } from "../shared/protocol.ts"
import { type ActionContext, applyAction, join, newRoom, type RoomState, viewFor } from "./game.ts"

const deck: Hog[] = Array.from({ length: 40 }, (_, i) => ({ id: `hog-${i}`, name: `Hog ${i}` }))
const zero = () => 0

function setup(): { room: RoomState; ctx: ActionContext; act: (who: string, msg: ClientMessage) => void } {
  const room = newRoom("ABCD", 0)
  join(room, "alice", "Alice", 1)
  join(room, "bob", "Bob", 2)
  join(room, "carol", "Carol", 3)
  const ctx: ActionContext = { online: new Set(["alice", "bob", "carol"]), deck, random: zero }
  const act = (who: string, msg: ClientMessage) => {
    const result = applyAction(room, who, msg, ctx)
    if (!result.ok) throw new Error(result.error)
  }
  return { room, ctx, act }
}

function started() {
  const s = setup()
  s.act("alice", { t: "sit", seat: 0 })
  s.act("bob", { t: "sit", seat: 1 })
  s.act("carol", { t: "start" })
  return s
}

test("players pick seats and anyone can start once both are filled", () => {
  const { room, act } = setup()
  act("alice", { t: "sit", seat: 0 })
  assert.throws(() => act("carol", { t: "start" }), /Both seats/)
  assert.throws(() => act("bob", { t: "sit", seat: 0 }), /already sitting/)
  act("bob", { t: "sit", seat: 1 })
  act("carol", { t: "start" })
  assert.equal(room.phase, "playing")
  assert.equal(room.game!.board.length, 24)
  assert.notEqual(room.game!.players[0].secret, room.game!.players[1].secret)
})

test("questions alternate turns via answers", () => {
  const { room, act } = started()
  assert.equal(room.game!.turn, 0)
  assert.throws(() => act("bob", { t: "ask", text: "Hat?" }), /not your turn/)
  act("alice", { t: "ask", text: "  Does it wear   a hat? " })
  assert.throws(() => act("alice", { t: "answer", yes: true }), /other player/)
  assert.throws(() => act("alice", { t: "guess", index: 3 }), /Wait/)
  act("bob", { t: "answer", yes: false })
  assert.deepEqual(room.game!.log[0], { id: 1, seat: 0, kind: "question", text: "Does it wear a hat?", answer: false })
  assert.equal(room.game!.turn, 1)
})

test("a correct guess wins, a wrong one loses", () => {
  const right = started()
  const target = right.room.game!.players[1].secret
  right.act("alice", { t: "guess", index: target })
  assert.equal(right.room.game!.winner, 0)
  assert.equal(right.room.wins.alice, 1)

  const wrong = started()
  const miss = (wrong.room.game!.players[1].secret + 1) % 24
  wrong.act("alice", { t: "guess", index: miss })
  assert.equal(wrong.room.game!.winner, 1)
  assert.equal(wrong.room.game!.endReason, "wrong-guess")
})

test("players only see their own secret but can see the backs of both boards", () => {
  const { room, ctx, act } = started()
  act("alice", { t: "flip", index: 5, down: true })
  const alice = viewFor(room, "alice", ctx.online).game!
  const bob = viewFor(room, "bob", ctx.online).game!
  const carol = viewFor(room, "carol", ctx.online).game!

  assert.notEqual(alice.players[0].secret, null)
  assert.equal(alice.players[1].secret, null)
  assert.equal(bob.players[0].secret, null)
  assert.equal(bob.players[0].flipped[5], true)
  assert.equal(bob.players[0].standing, 23)
  assert.notEqual(carol.players[0].secret, null)
  assert.notEqual(carol.players[1].secret, null)
  assert.equal(carol.players[0].flipped[5], true)
})

test("seats are locked mid-game and spectators can't play", () => {
  const { act } = started()
  assert.throws(() => act("alice", { t: "stand" }), /locked/)
  assert.throws(() => act("carol", { t: "flip", index: 0, down: true }), /Only players/)
})

test("an offline player's seat can be freed by anyone", () => {
  const { room, ctx, act } = setup()
  act("alice", { t: "sit", seat: 0 })
  assert.throws(() => act("carol", { t: "clearSeat", seat: 0 }), /has left/)
  ctx.online.delete("alice")
  act("carol", { t: "clearSeat", seat: 0 })
  assert.equal(room.seats[0], null)
  assert.equal(room.members.alice, undefined)
})

test("rematch deals a fresh board with the same seats", () => {
  const { room, act } = started()
  act("bob", { t: "forfeit" })
  assert.equal(room.game!.winner, 0)
  act("carol", { t: "rematch" })
  assert.equal(room.phase, "playing")
  assert.equal(room.game!.round, 2)
  assert.deepEqual(room.seats, ["alice", "bob"])
})
