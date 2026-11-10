import type {OilPaint} from '#src/lib/materials/oilPaints.ts'
import type {PartyOffset} from '../lib/partySite.ts'

import {paintIndex} from '#src/lib/materials/oilPaints.ts'

/** a stroke of oil paint that an unseen brush lays into the air around its origin, curving around it */
export type BrushStroke = {
  /** where around the origin it sets out from, as an angle in the wall’s plane: 0 to the right along the wall, a quarter turn up */
  angle: number
  /** how far its middle bulges out from the origin beyond a plain spiral, in meters, or in toward it where negative, as a hand swings the brush */
  bend: number
  /** seconds after the burst that the brush sets down */
  delay: number
  /** seconds the brush takes from setting down to lifting off */
  duration: number
  /** how far out of the wall’s plane in front of the origin it lies, at its start and at its end, in meters */
  out: readonly [start: number, end: number]
  /** the paint it is laid in, an index into `paintOrder`, and the paint the brush was dipped into on one side as well, the same for none */
  paint: readonly [number, number]
  /** sets its bristles and its drying apart from the others’, 0–1 */
  phase: number
  /** how far out from the origin it lies, at its start and at its end, in meters */
  reach: readonly [start: number, end: number]
  /** which ring around the origin it belongs to, from the one hugging its rim outward */
  ring: number
  /** how far it curves around the origin, in radians, its sign the way round */
  sweep: number
  /** how fast it turns on around the origin once it is laid, in radians a second, the way it curves */
  turn: number
  /** how wide the brush is, in meters */
  width: number
}

/** seconds after the burst that the first stroke starts drying away, how much later the last one does and how long each takes, from where it was set down to where the brush lifted off */
export const strokeDrying = {
  start: 2.3,
  stagger: 0.55,
  seconds: 0.75,
} as const
/** how far the strokes swell out from the origin a second once they are laid, as a share of their reach, and how fast they drift out into the room, in m/s */
export const strokeDrift = {
  swell: 0.04,
  out: 0.05,
} as const

const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
const between = (index: number, seed: number, low: number, high: number) => low + sequence(index, seed) * (high - low)
/** the rings of strokes around the origin, from the one hugging its rim outward: how many strokes, how far out they start and end, how far each curves, how far out of the wall’s plane, how wide and how fast it turns on, and where around the first sets out, in turns */
const rings = [
  {
    count: 6,
    reach: [0.58, 0.74],
    sweep: 1.4,
    out: [0.06, 0.1],
    width: 0.15,
    turn: 0.22,
    offset: 0.04,
  },
  {
    count: 6,
    reach: [0.76, 1.04],
    sweep: 1.5,
    out: [0.14, 0.24],
    width: 0.19,
    turn: 0.15,
    offset: 0.54,
  },
  {
    count: 5,
    reach: [1, 1.42],
    sweep: 1.2,
    out: [0.27, 0.42],
    width: 0.23,
    turn: 0.09,
    offset: 0.29,
  },
] as const
/** the paints the strokes take turns in, and the one the brush was dipped into on one side as well, or none */
const loads: ReadonlyArray<readonly [OilPaint, OilPaint?]> = [
  ['ultramarine'],
  ['cadmiumYellow', 'titaniumWhite'],
  ['vermilion'],
  ['viridian', 'cadmiumYellow'],
  ['titaniumWhite'],
  ['ultramarine', 'titaniumWhite'],
  ['cadmiumYellow'],
  ['vermilion', 'cadmiumYellow'],
]
/** seconds from when the brush sets down one stroke to when it sets down the next */
const pace = 0.052

/**
 * A flourish of broad, loaded strokes that unseen brushes lay into the air around the origin one after another, ring by ring outward, all curving around it the same way like the swirls of a starry night sky, every stroke in a paint of its own and some streaked with a second one along their side, then turning on, the inner rings faster, and drifting out into the room until the paint runs dry.
 * They are listed from the ring nearest the wall outward, the order they are drawn in.
 */
export const brushStrokes: ReadonlyArray<BrushStroke> = rings.flatMap((ring, ringIndex) => {
  const before = rings.slice(0, ringIndex).reduce((sum, {count}) => sum + count, 0)
  return Array.from({length: ring.count}, (_, index): BrushStroke => {
    const order = before + index
    const [paint, streak = paint] = loads[order % loads.length]
    return {
      ring: ringIndex,
      delay: 0.05 + order * pace + between(order, 0.31, 0, 0.02),
      duration: between(order * 3, 0.17, 0.24, 0.34),
      angle: (index / ring.count + ring.offset + between(order * 5, 0.61, -0.03, 0.03)) * Math.PI * 2,
      sweep: ring.sweep * between(order * 7, 0.43, 0.85, 1.15),
      reach: [ring.reach[0] * between(order * 11, 0.29, 0.95, 1.05), ring.reach[1] * between(order * 13, 0.71, 0.95, 1.05)],
      bend: between(order * 23, 0.37, -0.06, 0.12) * ring.reach[1],
      out: ring.out,
      width: ring.width * between(order * 17, 0.07, 0.85, 1.1),
      turn: ring.turn,
      paint: [paintIndex(paint), paintIndex(streak)],
      phase: sequence(order * 19, 0.53),
    }
  })
})

/** seconds after the burst that the last stroke has dried away */
export const strokesDone = strokeDrying.start + strokeDrying.stagger + strokeDrying.seconds

/**
 * Where on the stroke the point `share` of the way from where the brush set down to where it lifts off lies, `seconds` after it was set down, from the origin: curving around the origin and, once laid, turning on, swelling out and drifting into the room.
 * `PaintedStrokes` lays them out the same way on the GPU.
 */
export function strokePoint({angle, bend, out, reach, sweep, turn}: BrushStroke, share: number, seconds: number): PartyOffset {
  const since = Math.max(0, seconds)
  const around = angle + sweep * share + Math.sign(sweep) * turn * since
  const distance = (reach[0] + (reach[1] - reach[0]) * share + bend * Math.sin(Math.PI * share)) * (1 + strokeDrift.swell * since)
  return [Math.cos(around) * distance, Math.sin(around) * distance, out[0] + (out[1] - out[0]) * share + strokeDrift.out * since]
}
