import type {ShowcasedKnot} from '#src/lib/gallery/showcasedKnots.ts'
import type {Rarity} from 'knot-materials'
import type {Vec3} from 'math'

import {common, ethereal, knots, prime, rare} from 'knot-materials'
import {knotSign} from 'knot-materials/signs.ts'

import {environmentRandom} from '#src/lib/environmentSeed.ts'
import {pedestalHeight} from '#src/lib/gallery/PedestalGeometry.ts'
import {salonBench, salonPedestal} from '#src/lib/gallery/salon.ts'
import {knotStandingHeight, standingKnotSink} from '#src/lib/physics/standingKnot.ts'

/** how likely each rarity is for the Salon’s Knot; the Knot is then picked among the rarity’s */
export const salonKnotRarityChances = [
  [common, 0.4],
  [rare, 0.3],
  [prime, 0.25],
  [ethereal, 0.05],
] as const satisfies ReadonlyArray<readonly [Rarity, number]>

/** the Salon Knot’s scale, measured as the height of its standing pose in meters */
export const salonKnotHeight = 1

/** Keep the seed’s existing Knot pool stable when restoring the floating showcase. */
export const salonKnots = knots.filter(knot => (knot.displacement ?? 0) * salonKnotHeight / knotStandingHeight <= standingKnotSink)

const [signX, signZ] = [17, -21.6]
/** the Knot’s nameplate on its stand, out on the floor near the ottoman, east of the room’s axis, facing the ottoman */
export const salonKnotSign = {
  position: [signX, knotSign.elevation, signZ] as Vec3,
  // Facing +z at no rotation, turned toward the ottoman’s middle.
  rotation: Math.atan2(salonBench.position[0] - signX, salonBench.position[2] - signZ),
}

const knotsByRarity = Map.groupBy(salonKnots, knot => knot.rarity)

/** The Knot hovering over the Salon’s pedestal in the environment of `seed`: rarity is rolled first, then a Knot of that rarity, so the seed alone decides it. */
export default function salonKnot(seed: number): ShowcasedKnot {
  const random = environmentRandom(seed).makeChild('salon-knot')
  const [rarity] = random.makeChild('rarity').rollItem(salonKnotRarityChances, {weights: ([, chance]) => chance})
  return {
    entry: random.makeChild('entry').rollItem(knotsByRarity.get(rarity)!),
    height: salonKnotHeight,
    position: [salonPedestal[0], salonPedestal[1] + pedestalHeight, salonPedestal[2]],
  }
}
