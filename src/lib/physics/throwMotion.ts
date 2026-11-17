import type {Vec3} from '../gallery/types.ts'

/** The default speed of a medium-weight prop, also used by the scripted throw tool. */
export const throwSpeed = 10

/** Speed peaks at a hand-sized weight, falling off for both extremely light and heavy objects. */
export function throwStrength(mass: number) {
  const ratio = Math.max(0.001, Number.isFinite(mass) ? mass : 1.8) / 1.8
  return throwSpeed * Math.sqrt(2 / (ratio + 1 / ratio))
}

/** Release velocity in world m/s. The carrier’s momentum carries drops as well as throws. */
export function throwMotion(mass: number, direction: Vec3, carrier: Vec3, throwing: boolean): Vec3 {
  if (!throwing) {
    return [...carrier]
  }
  const length = Math.hypot(...direction) || 1
  const unit = direction.map(value => value / length)
  const speed = throwStrength(mass)
  // Forward movement adds momentum; upward movement adds a little extra loft to a jumping throw.
  return [unit[0] * speed + carrier[0], unit[1] * speed + 2 * speed / 10 + carrier[1] + Math.max(0, carrier[1]) * 0.3, unit[2] * speed + carrier[2]]
}

/** A lower tone for a heavier, slower release. */
export function throwTone(mass: number, velocity: Vec3) {
  const speed = Math.hypot(...velocity)
  return Math.max(75, Math.min(280, 105 + speed * 9 - 20 * Math.log2(Math.max(0.05, mass) / 1.8)))
}
