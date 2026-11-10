import type {PartyOffset} from '../lib/partySite.ts'

/** a tendril that lashes out of the origin as it bursts */
export type LashingTendril = {
  /** where it reaches toward, as an angle around the origin in the wall’s plane: 0 to the right along the wall, a quarter turn up */
  angle: number
  /** how far its tip hooks, in its lengths, its sign the way */
  curl: number
  /** seconds after the burst that it lashes out */
  delay: number
  /** how long it is once it is out, in meters */
  length: number
  /** how far it reaches out the way the site faces rather than along the wall, 0–1 */
  out: number
  /** sets its writhing apart from the others’, 0–1 */
  phase: number
  /** seconds after the burst that it starts snapping back into the origin */
  retract: number
  /** how thick it is at its root, in meters */
  width: number
}

/** seconds a tendril takes to lash out */
export const lashing = 0.3
/** seconds a tendril takes to snap back into the origin */
export const snapping = 0.3
const degrees = Math.PI / 180

/** Seven fleshy tendrils lashing out of the origin in quick succession all round it, clear of where a fusion’s result flies out of its middle, out the way the site faces, writhing and groping about, until they snap back into it one after another, the first ones first. */
export const lashingTendrils: ReadonlyArray<LashingTendril> = [
  [160, 0.55, 1.45, 0.2, 0.02, 1.85, 0.35],
  [210, 0.7, 1.25, 0.18, 0.07, 2.05, -0.3],
  [250, 0.6, 1.6, 0.22, 0.04, 1.95, 0.4],
  [290, 0.75, 1.35, 0.18, 0.1, 2.15, -0.45],
  [335, 0.55, 1.7, 0.23, 0, 1.9, 0.3],
  [20, 0.65, 1.4, 0.19, 0.06, 2.1, -0.35],
  [55, 0.5, 1.2, 0.17, 0.12, 2, 0.5],
].map(([angle, out, length, width, delay, retract, curl], index) => ({
  angle: angle * degrees,
  out,
  length,
  width,
  delay,
  retract,
  curl,
  phase: index * 0.618 % 1,
}))

/** Where the tip of a tendril reaches once it is out, from the origin, leaving its writhing aside. */
export function tendrilReach({angle, length, out}: LashingTendril): PartyOffset {
  const along = Math.cos(angle) * (1 - out)
  const up = Math.sin(angle) * (1 - out)
  const scale = length / Math.hypot(along, up, out)
  return [along * scale, up * scale, out * scale]
}
