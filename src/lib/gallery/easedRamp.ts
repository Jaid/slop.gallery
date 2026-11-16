import {clamp} from 'math'

/** At most this far apart along a ramp, its eased profile runs straight from knot to knot. */
export const rampKnotSpacing = 0.25

/** how many straight stretches a ramp `length` meters long takes, none longer than `spacing` */
const stretches = (length: number, spacing: number) => Math.max(1, Math.ceil(length / spacing))
const eased = (t: number) => t * t * (3 - 2 * t)

/**
 * How far up a ramp `length` meters long a point `along` meters into it has climbed, as a fraction of its whole rise: level where it starts and where it ends, steepest halfway, like the ramp up the Oculus’ tower.
 * The eased profile runs straight from knot to knot, at most `spacing` apart, so rendering, collision and navigation share it wherever they follow it through its knots.
 */
export default function easedRamp(along: number, length: number, spacing = rampKnotSpacing) {
  const count = stretches(length, spacing)
  const position = clamp(along / length, 0, 1) * count
  const index = Math.min(Math.floor(position), count - 1)
  const from = eased(index / count)
  return from + (eased((index + 1) / count) - from) * (position - index)
}

/** How steeply the eased profile climbs `along` meters into a ramp `length` meters long, as a fraction of its whole rise per meter: halfway, 1.5 times as steeply as a straight ramp would. */
export function easedRampGradient(along: number, length: number) {
  const t = clamp(along / length, 0, 1)
  return 6 * t * (1 - t) / length
}

/** where the knots of a ramp `length` meters long lie, in meters into it, from its start to its end */
export function easedRampKnots(length: number, spacing = rampKnotSpacing) {
  const count = stretches(length, spacing)
  return Array.from({length: count + 1}, (_, i) => length * i / count)
}

/**
 * Where the knots of a ramp `length` meters long lie, in meters into it, from its start to its end, so that its eased profile, climbing by `rise` meters, bends by about `turn` (rise over run) at each of them and no more than twice that: where the eased curve bends most, near its ends, they lie close, and they spread out toward its middle, where it hardly bends, but never further apart than `spacing`.
 * At its knots, the profile’s steepness steps up evenly from level to its steepest halfway and back down, so the first stretch climbs only half a step.
 */
export function easedRampTurnKnots(length: number, rise: number, turn: number, spacing: number) {
  if (!(length > 0) || !Number.isFinite(rise) || !(turn > 0) || !(spacing > 0)) {
    throw new RangeError('A ramp’s knots need a positive length, a finite rise and a positive turn and spacing.')
  }
  // How many steps its steepness takes from level up to 1.5 times the straight ramp’s, halfway.
  const steps = Math.max(1, Math.ceil(1.5 * Math.abs(rise) / length / turn))
  /** where the eased curve, 6 t (1 − t) steep, is `share` of its steepest, on the way up */
  const rising = (share: number) => (1 - Math.sqrt(1 - share)) / 2
  const half = Array.from({length: steps}, (_, step) => rising(step / steps))
  const shares = [...half, 0.5, ...half.toReversed().map(t => 1 - t)]
  const knots: Array<number> = []
  for (const [index, share] of shares.entries()) {
    const at = share * length
    const previous = knots.at(-1)
    if (index && previous !== undefined) {
      const gaps = Math.ceil((at - previous) / spacing - 1e-9)
      for (let gap = 1; gap < gaps; gap++) {
        knots.push(previous + (at - previous) * gap / gaps)
      }
    }
    knots.push(at)
  }
  return knots
}
