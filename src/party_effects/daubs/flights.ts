import type {OilPaint} from '#src/lib/materials/oilPaints.ts'
import type {PartyOffset} from '../lib/partySite.ts'

import {paintIndex} from '#src/lib/materials/oilPaints.ts'

/** a thick palette-knife slab of impasto paint flung out around its origin */
export type PaletteDaub = {
  /** where around the origin it sets out from, in radians */
  angle: number
  /** seconds after the burst that the daub appears */
  delay: number
  /** how long it flies outward before settling into its drift, in seconds */
  flight: number
  /** how long the daub remains visible before crusting and flaking away, in seconds */
  life: number
  /** how far out in front of the wall’s plane it starts and finishes, in meters */
  out: readonly [start: number, end: number]
  /** the two unmixed paints loaded on the knife, as indices into `paintOrder` */
  paint: readonly [number, number]
  /** 0–1, sets its facets, striations and flaking apart from the others’ */
  phase: number
  /** how far from the origin in the wall’s plane it starts and ends, in meters */
  reach: readonly [start: number, end: number]
  /** which ring around the origin it belongs to */
  ring: number
  /** how wide and tall the slab is, in meters */
  size: readonly [width: number, height: number]
  /** how fast the daub turns as it floats, in radians a second */
  spin: number
  /** initial tilt of the knife stroke on screen, in radians */
  tilt: number
}

const goldenRatio = (Math.sqrt(5) - 1) / 2
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
const between = (index: number, seed: number, low: number, high: number) => low + sequence(index, seed) * (high - low)
const rings = [
  {
    count: 7,
    reach: [0.68, 0.96],
    out: [0.12, 0.34],
    size: [0.22, 0.13],
    flight: 0.45,
    offset: 0.05,
  },
  {
    count: 7,
    reach: [0.82, 1.24],
    out: [0.22, 0.56],
    size: [0.26, 0.16],
    flight: 0.55,
    offset: 0.42,
  },
  {
    count: 7,
    reach: [0.95, 1.5],
    out: [0.32, 0.82],
    size: [0.3, 0.18],
    flight: 0.65,
    offset: 0.21,
  },
] as const
const loads: ReadonlyArray<readonly [OilPaint, OilPaint]> = [
  ['cadmiumYellow', 'titaniumWhite'],
  ['vermilion', 'cadmiumYellow'],
  ['ultramarine', 'titaniumWhite'],
  ['viridian', 'cadmiumYellow'],
  ['titaniumWhite', 'ultramarine'],
  ['vermilion', 'titaniumWhite'],
  ['cadmiumYellow', 'viridian'],
]

/**
 * Thick palette-knife daubs of unmixed oil paint burst out around the portal in three staggered rings, turning slightly as they drift forward into the room before crusting and flaking away.
 */
export const impastoDaubs: ReadonlyArray<PaletteDaub> = rings.flatMap((ring, ringIndex) => {
  const before = rings.slice(0, ringIndex).reduce((sum, {count}) => sum + count, 0)
  return Array.from({length: ring.count}, (_, index): PaletteDaub => {
    const order = before + index
    const [primary, secondary] = loads[order % loads.length]
    const angle = (index / ring.count + ring.offset + between(order, 0.23, -0.03, 0.03)) * Math.PI * 2
    return {
      ring: ringIndex,
      delay: 0.04 + order * 0.032 + between(order, 0.41, 0, 0.02),
      flight: ring.flight * between(order, 0.17, 0.9, 1.15),
      life: 2.85 + between(order, 0.67, 0, 0.45),
      angle,
      reach: [ring.reach[0] * between(order, 0.31, 0.95, 1.06), ring.reach[1] * between(order, 0.53, 0.94, 1.08)],
      out: [ring.out[0], ring.out[1] * between(order, 0.79, 0.9, 1.12)],
      size: [ring.size[0] * between(order, 0.13, 0.9, 1.15), ring.size[1] * between(order, 0.37, 0.9, 1.15)],
      tilt: angle + between(order, 0.59, -0.5, 0.5),
      spin: between(order, 0.83, -0.32, 0.32),
      paint: [paintIndex(primary), paintIndex(secondary)],
      phase: sequence(order * 11, 0.47),
    }
  })
})

/** seconds after the burst that the last daub has flaked away */
export const daubsDone = Math.max(...impastoDaubs.map(({delay, life}) => delay + life))

/** Where a daub’s center lies `seconds` after it burst out, relative to the site’s origin. */
export function daubOffset({angle, flight, out, reach}: PaletteDaub, seconds: number): PartyOffset {
  const since = Math.max(0, seconds)
  const share = Math.min(1, since / flight)
  const eased = 1 - (1 - share) ** 3
  const distance = reach[0] + (reach[1] - reach[0]) * eased
  // Keeps daubs comfortably above the floor even on lower portals.
  const up = Math.max(-0.85, Math.sin(angle) * distance)
  return [Math.cos(angle) * distance, up, out[0] + (out[1] - out[0]) * eased + Math.max(0, since - flight) * 0.08]
}
