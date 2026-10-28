import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import { normalizeRoomCode } from "../shared/protocol.ts"
import { Home } from "./screens/Home.tsx"
import { NamePrompt } from "./screens/NamePrompt.tsx"
import { Room } from "./screens/Room.tsx"
import { savedName } from "./lib/identity.ts"

const World = lazy(() => import("./components/World.tsx"))

const roomFromPath = () => normalizeRoomCode(location.pathname.match(/^\/r\/([^/]+)/)?.[1] ?? "")

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return reduced
}

export function App() {
  const [code, setCode] = useState(roomFromPath)
  const [named, setNamed] = useState(() => savedName() !== "")
  const [homeError, setHomeError] = useState<string>()
  const still = useReducedMotion()

  useEffect(() => {
    const onPop = () => setCode(roomFromPath())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const enterRoom = useCallback((next: string) => {
    history.pushState(null, "", `/r/${next}`)
    setHomeError(undefined)
    setNamed(true)
    setCode(next)
  }, [])

  const leave = useCallback((error?: string) => {
    history.pushState(null, "", "/")
    setHomeError(error)
    setCode(null)
  }, [])

  return (
    <>
      <div className="world" aria-hidden="true">
        <Suspense fallback={null}>
          <World still={still} />
        </Suspense>
      </div>
      <div className="app">
        {!code ? (
          <Home key={homeError} onEnterRoom={enterRoom} initialError={homeError} />
        ) : !named ? (
          <NamePrompt code={code} onDone={() => setNamed(true)} />
        ) : (
          <Room key={code} code={code} onLeave={leave} />
        )}
      </div>
    </>
  )
}
