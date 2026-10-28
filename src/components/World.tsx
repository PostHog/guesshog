// The blurred diorama behind the UI: a floating island where hoggies hop
// around a giant Guess Who board whose cards keep flipping, with question marks
// and clouds drifting past. Loaded lazily so the game UI never waits for three.js.
import { Billboard } from "@react-three/drei"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { Suspense, useMemo, useRef } from "react"
import * as THREE from "three"
import deck from "../../shared/hoggies.json"
import type { Hog } from "../../shared/protocol.ts"
import { excitement } from "../lib/celebrate.ts"
import { hogImage } from "../lib/hogs.ts"

const C = {
  ink: "#320601",
  sky: "#ABE1F2",
  grass: "#47C861",
  grassDark: "#35B14E",
  lime: "#A0CA21",
  teal: "#25BC95",
  dirt: "#9C5B3B",
  dirtDark: "#6E3A22",
  trunk: "#7A4528",
  coral: "#FF474D",
  coralDark: "#F00008",
  cobalt: "#0457FF",
  lemon: "#FFCE1C",
  violet: "#6D4FFF",
  tangerine: "#FF5C1C",
  white: "#FFFFFF",
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Excitement = typeof excitement

const excitementLevel = (excitement: Excitement, now: number) => Math.max(0, 1 - (now - excitement.at) / 4000)

function Island() {
  const trees = useMemo(() => {
    const rand = mulberry32(7)
    return Array.from({ length: 34 }, () => {
      const angle = rand() * Math.PI * 2
      const radius = 8.5 + rand() * 13
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 0.7 + rand() * 0.8,
        round: rand() > 0.55,
        color: [C.grassDark, C.teal, C.lime][Math.floor(rand() * 3)],
      }
    })
  }, [])

  return (
    <group>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[24, 24, 1, 40]} />
        <meshLambertMaterial color={C.grass} flatShading />
      </mesh>
      <mesh position={[0, -5.5, 0]}>
        <cylinderGeometry args={[24, 6, 9, 40, 2]} />
        <meshLambertMaterial color={C.dirt} flatShading />
      </mesh>
      <mesh position={[0, -11.5, 0]}>
        <coneGeometry args={[6, 5, 8]} />
        <meshLambertMaterial color={C.dirtDark} flatShading />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.scale}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.18, 0.25, 1.2, 6]} />
            <meshLambertMaterial color={C.trunk} flatShading />
          </mesh>
          {t.round ? (
            <mesh position={[0, 2, 0]}>
              <icosahedronGeometry args={[1.15, 0]} />
              <meshLambertMaterial color={t.color} flatShading />
            </mesh>
          ) : (
            <mesh position={[0, 2.3, 0]}>
              <coneGeometry args={[1.1, 2.8, 6]} />
              <meshLambertMaterial color={t.color} flatShading />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/** A giant Guess Who tray in the middle of the island. Its cards flip down and back up on their own. */
function GiantBoard({ textures }: { textures: THREE.Texture[] }) {
  const cards = useRef<(THREE.Group | null)[]>([])
  const state = useMemo(() => {
    const rand = mulberry32(42)
    return Array.from({ length: 24 }, () => ({ down: rand() > 0.6, nextFlip: rand() * 6, angle: 0 }))
  }, [])
  const cardMaterial = useMemo(() => {
    const white = new THREE.MeshLambertMaterial({ color: C.white })
    return [white, white, white, white, white, new THREE.MeshLambertMaterial({ color: C.coralDark })]
  }, [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    state.forEach((card, i) => {
      if (t > card.nextFlip) {
        card.down = !card.down
        card.nextFlip = t + 2 + ((i * 7.3) % 5)
      }
      const target = card.down ? -Math.PI / 2.2 : 0
      card.angle += (target - card.angle) * Math.min(1, delta * 6)
      const group = cards.current[i]
      if (group) group.rotation.x = card.angle
    })
  })

  return (
    <group position={[0, 0, 0]} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[9.6, 0.7, 6.4]} />
        <meshLambertMaterial color={C.coral} flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[10, 0.3, 6.8]} />
        <meshLambertMaterial color={C.coralDark} flatShading />
      </mesh>
      {state.map((_, i) => {
        const col = i % 6
        const row = Math.floor(i / 6)
        return (
          <group key={i} position={[-3.75 + col * 1.5, 0.7, -2.2 + row * 1.45]} ref={(g) => void (cards.current[i] = g)}>
            <mesh position={[0, 0.65, 0]} material={cardMaterial}>
              <boxGeometry args={[1.2, 1.3, 0.08]} />
            </mesh>
            <mesh position={[0, 0.65, 0.045]}>
              <planeGeometry args={[1.1, 1.1]} />
              <meshBasicMaterial map={textures[i % textures.length]} transparent alphaTest={0.4} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Hoggies({ textures, excitement }: { textures: THREE.Texture[]; excitement: Excitement }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const walkers = useMemo(() => {
    const rand = mulberry32(3)
    return textures.map((_, i) => ({
      radius: 7 + rand() * 12,
      speed: (0.05 + rand() * 0.08) * (rand() > 0.5 ? 1 : -1),
      phase: (i / textures.length) * Math.PI * 2,
      hop: 4 + rand() * 3,
    }))
  }, [textures])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const boost = excitementLevel(excitement, performance.now())
    walkers.forEach((w, i) => {
      const g = refs.current[i]
      if (!g) return
      const angle = w.phase + t * w.speed
      g.position.set(Math.cos(angle) * w.radius, 1.6 + Math.abs(Math.sin(t * w.hop)) * (0.35 + boost * 2.2), Math.sin(angle) * w.radius)
    })
  })

  return (
    <>
      {textures.map((map, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Billboard>
            <mesh>
              <planeGeometry args={[3.4, 3.4]} />
              <meshBasicMaterial map={map} transparent alphaTest={0.4} />
            </mesh>
          </Billboard>
        </group>
      ))}
    </>
  )
}

function QuestionMark({ color, position, speed, excitement }: { color: string; position: [number, number, number]; speed: number; excitement: Excitement }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    const boost = excitementLevel(excitement, performance.now())
    ref.current.rotation.y += delta * speed * (1 + boost * 8)
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * speed * 2) * 0.8
  })
  return (
    <group ref={ref} position={position} scale={1.4}>
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[0, 0.6, 0]}>
        <torusGeometry args={[0.6, 0.24, 10, 24, Math.PI * 1.5]} />
        <meshLambertMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.5, 10]} />
        <meshLambertMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, -1.05, 0]}>
        <sphereGeometry args={[0.28, 10, 8]} />
        <meshLambertMaterial color={color} flatShading />
      </mesh>
    </group>
  )
}

function Clouds() {
  const group = useRef<THREE.Group>(null)
  const clouds = useMemo(() => {
    const rand = mulberry32(11)
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2 + rand()
      const radius = 30 + rand() * 18
      return {
        position: [Math.cos(angle) * radius, -6 + rand() * 22, Math.sin(angle) * radius] as [number, number, number],
        puffs: Array.from({ length: 4 + Math.floor(rand() * 3) }, (_, j) => ({
          offset: [j * 1.6 - 3, rand() * 0.8, rand() * 1.2] as [number, number, number],
          size: 1.3 + rand() * 1.2,
        })),
      }
    })
  }, [])
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.01
  })
  return (
    <group ref={group}>
      {clouds.map((cloud, i) => (
        <group key={i} position={cloud.position}>
          {cloud.puffs.map((puff, j) => (
            <mesh key={j} position={puff.offset}>
              <icosahedronGeometry args={[puff.size, 1]} />
              <meshLambertMaterial color={C.white} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.035
    camera.position.set(Math.cos(t) * 50, 17 + Math.sin(t * 2) * 3, Math.sin(t) * 50)
    camera.lookAt(0, -3, 0)
  })
  return null
}

function Scene({ excitement }: { excitement: Excitement }) {
  const picks = useMemo(() => {
    const shuffled = [...(deck as Hog[])].sort(() => Math.random() - 0.5)
    return { walkers: shuffled.slice(0, 10), cards: shuffled.slice(10, 18) }
  }, [])
  const walkerTextures = useLoader(THREE.TextureLoader, picks.walkers.map(hogImage))
  const cardTextures = useLoader(THREE.TextureLoader, picks.cards.map(hogImage))
  useMemo(() => {
    for (const t of [...walkerTextures, ...cardTextures]) t.colorSpace = THREE.SRGBColorSpace
  }, [walkerTextures, cardTextures])

  return (
    <>
      <GiantBoard textures={cardTextures} />
      <Hoggies textures={walkerTextures} excitement={excitement} />
    </>
  )
}

export default function World({ still }: { still: boolean }) {
  return (
    <Canvas
      className="world-canvas"
      dpr={[0.5, 0.75]}
      frameloop={still ? "demand" : "always"}
      camera={{ fov: 45, position: [50, 17, 0], near: 1, far: 220 }}
      gl={{ antialias: false, powerPreference: "low-power" }}
    >
      <color attach="background" args={[C.sky]} />
      <fog attach="fog" args={[C.sky, 60, 140]} />
      <hemisphereLight args={["#ffffff", C.grassDark, 1.6]} />
      <directionalLight position={[20, 30, 10]} intensity={1.8} />
      <CameraRig />
      <Island />
      <Clouds />
      <QuestionMark color={C.lemon} position={[-9, 10, -6]} speed={0.6} excitement={excitement} />
      <QuestionMark color={C.violet} position={[10, 8, 7]} speed={0.8} excitement={excitement} />
      <QuestionMark color={C.tangerine} position={[4, 13, -12]} speed={0.5} excitement={excitement} />
      <QuestionMark color={C.cobalt} position={[-12, 7, 9]} speed={0.7} excitement={excitement} />
      <Suspense fallback={null}>
        <Scene excitement={excitement} />
      </Suspense>
    </Canvas>
  )
}
