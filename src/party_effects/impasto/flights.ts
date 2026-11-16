import type {OilPaint} from '#src/lib/materials/oilPaints.ts'
import type {BrushStroke} from '../strokes/flights.ts'

import {paintIndex} from '#src/lib/materials/oilPaints.ts'

import {strokesDone} from '../strokes/flights.ts'

/** the golden ratio’s conjugate, for deterministic, evenly spread pseudo-random fractions */
const goldenRatio = (Math.sqrt(5) - 1) / 2
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
const between = (index: number, seed: number, low: number, high: number) => low + sequence(index, seed) * (high - low)
/** the rings of smears around the origin, from the one hugging its rim outward: how many, how far out they start and end, how far each is dragged round, how far out of the wall’s plane, how wide the knife is and where around the first sets out, in turns. Short, wide and barely turning, where the Paint Orb’s strokes curve on and on: a knife lays a slab and lifts. */
const rings = [
  {
    count: 5,
    reach: [0.72, 0.98],
    sweep: 0.5,
    out: [0.08, 0.16],
    width: 0.3,
    turn: 0.03,
    offset: 0.11,
  },
  {
    count: 5,
    reach: [1.02, 1.36],
    sweep: 0.42,
    out: [0.2, 0.34],
    width: 0.37,
    turn: 0.02,
    offset: 0.61,
  },
] as const
/** the paints the smears take turns in, loaded thick, and the one the knife picked up on one edge as well, or none */
const loads: ReadonlyArray<readonly [OilPaint, OilPaint?]> = [
  ['cadmiumYellow'],
  ['vermilion', 'titaniumWhite'],
  ['ultramarine'],
  ['titaniumWhite', 'cadmiumYellow'],
  ['viridian'],
  ['vermilion'],
  ['ultramarine', 'titaniumWhite'],
  ['cadmiumYellow', 'viridian'],
]
/** seconds from when the knife sets down one smear to when it sets down the next: a heavier tool than a brush, at a heavier pace */
const pace = 0.09

/**
 * Thick slabs of oil paint that unseen palette knives trowel into the air around the origin one after another, ring by ring outward: short, broad and laden, each dragged a little way round, neighboring slabs dragged against each other like the facets of a heavily worked canvas, then barely turning as they drift out into the room until the paint runs dry.
 * They are laid as brush strokes of the widest brush, so `PaintedStrokes` draws them and `strokePoint` lays them out.
 * They are listed from the ring nearest the wall outward, the order they are drawn in.
 */
export const knifeStrokes: ReadonlyArray<BrushStroke> = rings.flatMap((ring, ringIndex) => {
  const before = rings.slice(0, ringIndex).reduce((sum, {count}) => sum + count, 0)
  return Array.from({length: ring.count}, (_, index): BrushStroke => {
    const order = before + index
    const [paint, streak = paint] = loads[order % loads.length]
    return {
      ring: ringIndex,
      delay: 0.05 + order * pace + between(order, 0.31, 0, 0.02),
      duration: between(order * 3, 0.17, 0.45, 0.65),
      angle: (index / ring.count + ring.offset + between(order * 5, 0.61, -0.03, 0.03)) * Math.PI * 2,
      sweep: (order % 2 ? -1 : 1) * ring.sweep * between(order * 7, 0.43, 0.85, 1.15),
      reach: [ring.reach[0] * between(order * 11, 0.29, 0.95, 1.05), ring.reach[1] * between(order * 13, 0.71, 0.95, 1.05)],
      bend: between(order * 23, 0.37, -0.02, 0.04) * ring.reach[1],
      out: ring.out,
      width: ring.width * between(order * 17, 0.07, 0.85, 1.1),
      turn: ring.turn,
      paint: [paintIndex(paint), paintIndex(streak)],
      phase: sequence(order * 19, 0.53),
    }
  })
})

/** seconds after the burst that the last smear has dried away, at the brush strokes’ pace of drying */
export const knifeDone = strokesDone
