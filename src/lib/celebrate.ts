import confetti from "canvas-confetti"

/** Shared with the 3D world, which makes the hoggies jump for a few seconds after this changes. */
export const excitement = { at: -Infinity }

const COLORS = ["#FFCE1C", "#FF474D", "#0457FF", "#47C861", "#6D4FFF", "#FF5C1C"]

export function celebrate(big: boolean) {
  excitement.at = performance.now()
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const burst = (x: number, angle: number) =>
    confetti({ particleCount: big ? 120 : 40, spread: 70, startVelocity: 55, angle, origin: { x, y: 0.75 }, colors: COLORS, scalar: 1.2, zIndex: 70 })
  burst(0.1, 60)
  burst(0.9, 120)
}
