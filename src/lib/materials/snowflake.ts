import type {Node} from 'three/webgpu'

import {atan, float, smoothstep, vec2} from 'three/tsl'

/** a kind of snow crystal, in radii of the crystal, its arms reaching out to 1 */
export type SnowflakeDesign = {
  /** half the width of each arm at its root, narrowing toward the tip */
  arm: number
  /** whether short barbs feather the outer half of each arm, like the fronds of a fern */
  barbs?: boolean
  /** the side branches each arm puts out on either side, angled out toward its tip at 60° like the crystal’s own axes: where along the arm they spring from, 0–1, and how long they grow */
  branches: ReadonlyArray<readonly [at: number, length: number]>
  /** how far the hexagonal plate in the middle reaches, to its corners */
  plate: number
  /** how far the little hexagonal plate on the tip of each arm reaches, to its corners, or 0 for none */
  tip?: number
}

/** the arms’ angle apart, which every crystal’s sixfold symmetry repeats */
const sector = Math.PI / 3
const cos30 = Math.cos(Math.PI / 6)
const sin30 = Math.sin(Math.PI / 6)
const cos60 = Math.cos(Math.PI / 3)
const sin60 = Math.sin(Math.PI / 3)

/** a stellar dendrite: six long fern-like arms, branching three times on either side, round a small plate, like the large crystals of a cold, humid night */
export const stellarDendrite: SnowflakeDesign = {
  arm: 0.042,
  barbs: true,
  branches: [[0.24, 0.2], [0.42, 0.24], [0.6, 0.19], [0.76, 0.12]],
  plate: 0.16,
  tip: 0.07,
}
/** a fernlike star with fewer, longer branches */
export const fernStar: SnowflakeDesign = {
  arm: 0.07,
  branches: [[0.38, 0.32], [0.66, 0.2]],
  plate: 0.22,
  tip: 0.12,
}
/**
 * The inside of a snow crystal of the `design`, positive within it, in radii of the crystal, about its distance from the outline, so a glow made of it stays even, and where its ridges are, 0–1: the spine raised along each arm and the hexagons etched into its middle plate.
 * Six arms reach out to 1 along the crystal’s axes, the first along +x. Every arm, branch and barb is mirrored across its axis, so a pixel works out one twelfth of the crystal, whichever design it is.
 */
export function snowflakeShape(point: Node<'vec2'>, {arm, barbs = false, branches, plate, tip = 0}: SnowflakeDesign) {
  const radius = point.length()
  // Folded into the twelfth between an arm and the middle between it and the next, 0–30°.
  const turn = atan(point.y, point.x).div(sector).add(0.5).fract().sub(0.5).abs().mul(sector)
  const folded = vec2(turn.cos(), turn.sin()).mul(radius).toVar()
  const {x, y} = folded
  const spine = segment(folded, [0, 0], [1, 0])
  const armWidth = float(arm).mul(float(1).sub(spine.along.mul(0.5)))
  let inside: Node<'float'> = armWidth.sub(spine.distance)
  for (const [at, length] of branches) {
    const branch = segment(folded, [at, 0], [at + length * cos60, length * sin60])
    inside = inside.max(float(arm * 0.62).mul(float(1).sub(branch.along.mul(0.55))).sub(branch.distance))
  }
  if (barbs) {
    // Barbs every few hundredths along the outer half of the arm, each angled out like the branches and shorter toward the tip.
    const period = 0.05
    const root = x.sub(y.mul(cos60 / sin60))
    const across = root.div(period).add(0.5).fract().sub(0.5).abs().mul(period * sin60)
    const out = y.div(sin60)
    const length = float(1).sub(root).mul(0.14).min(root.sub(0.46).mul(0.5))
    // Bounded by the arm’s tip, so past it the value keeps falling like a distance would, and a glow made of it doesn’t streak out along the axis.
    inside = inside.max(float(arm * 0.42).sub(across).min(length.sub(out)).min(float(1).sub(root)))
  }
  inside = inside.max(hexagon(folded, plate))
  if (tip > 0) {
    inside = inside.max(hexagon(folded.sub(vec2(1 - tip * 0.6, 0)), tip))
  }
  // The spine along each arm, and two hexagons etched into the plate, a little inside one another.
  const raised = smoothstep(armWidth.mul(0.45), 0, y).mul(smoothstep(plate * 0.8, plate, x))
  const plateEdge = folded.dot(vec2(cos30, sin30))
  const etched = [0.42, 0.72].map(share => smoothstep(0.016, 0.004, plateEdge.sub(plate * cos30 * share).abs()))
  const ridge = raised.max(etched[0]).max(etched[1])
  return {
    inside,
    /** how far out along its arm the point lies, 0–1 at the tip */
    out: spine.along,
    ridge,
  }
}
/** The distance of `point` from the segment from `from` to `to`, and how far along it, 0–1, its nearest point lies. */
function segment(point: Node<'vec2'>, [fromX, fromY]: readonly [number, number], [toX, toY]: readonly [number, number]) {
  const [dx, dy] = [toX - fromX, toY - fromY]
  const square = dx * dx + dy * dy
  const offset = point.sub(vec2(fromX, fromY))
  const along = offset.dot(vec2(dx / square, dy / square)).clamp(0, 1)
  return {
    along,
    distance: offset.sub(vec2(dx, dy).mul(along)).length(),
  }
}
/** The inside of a hexagon of circumradius `radius` with a corner toward +x, positive within it, about its distance from the outline. */
function hexagon(point: Node<'vec2'>, radius: number) {
  const folded = point.abs()
  return float(radius * cos30).sub(folded.dot(vec2(cos30, sin30)).max(folded.y))
}
