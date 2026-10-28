import { useCallback, useEffect, useRef, useState } from "react"
import type { ClientMessage, Reaction, RoomView, ServerMessage } from "../../shared/protocol.ts"

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "missing"

export interface FloatingReaction {
  key: number
  emoji: Reaction
  name: string
  mine: boolean
}

export interface ErrorNotice {
  key: number
  message: string
}

const REACTION_LIFETIME_MS = 2600

/** Keeps a WebSocket open to one room, reconnecting with backoff, and exposes the latest view of it. */
export function useRoom(code: string, pid: string, name: string) {
  const [room, setRoom] = useState<RoomView | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("connecting")
  const [reactions, setReactions] = useState<FloatingReaction[]>([])
  const [error, setError] = useState<ErrorNotice | null>(null)
  const socket = useRef<WebSocket | null>(null)
  const counter = useRef(0)
  const nameRef = useRef(name)
  nameRef.current = name

  useEffect(() => {
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    const connect = async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`)
        const body = (await res.json()) as { exists?: boolean }
        if (cancelled) return
        if (!body.exists) return setStatus("missing")
      } catch {
        // offline; fall through to the socket, which will retry
      }

      const proto = location.protocol === "https:" ? "wss" : "ws"
      const params = new URLSearchParams({ pid, name: nameRef.current })
      const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws?${params}`)
      socket.current = ws

      ws.onopen = () => {
        attempts = 0
        setStatus("open")
      }
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage
        if (msg.t === "state") setRoom(msg.room)
        else if (msg.t === "error") setError({ key: ++counter.current, message: msg.message })
        else if (msg.t === "reaction") {
          const reaction = { key: ++counter.current, emoji: msg.emoji, name: msg.name, mine: msg.from === pid }
          setReactions((list) => [...list.slice(-20), reaction])
          setTimeout(() => setReactions((list) => list.filter((r) => r.key !== reaction.key)), REACTION_LIFETIME_MS)
        }
      }
      ws.onclose = () => {
        if (cancelled) return
        setStatus("reconnecting")
        attempts += 1
        retry = setTimeout(connect, Math.min(8000, 400 * 2 ** attempts))
      }
    }

    connect()
    return () => {
      cancelled = true
      clearTimeout(retry)
      socket.current?.close()
      socket.current = null
    }
  }, [code, pid])

  const send = useCallback((msg: ClientMessage) => {
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  return { room, status, reactions, error, send }
}
