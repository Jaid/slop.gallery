import type {StudioPlan} from '../plan.ts'
import type OpeningStyle from './base/OpeningStyle.ts'
import type {Point, Polygons} from './lib/polygons.ts'
import type {OpeningStyleId} from './openingParameter.ts'
import type {Vec3} from 'math'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'

import {ceilingShift, openingSpread, studioPlan, studioSlab} from '../plan.ts'
import {Rolls} from './base/OpeningStyle.ts'
import CofferStyle from './CofferStyle.ts'
import ConstellationStyle from './ConstellationStyle.ts'
import CrescentStyle from './CrescentStyle.ts'
import FoilStyle from './FoilStyle.ts'
import GirihStyle from './GirihStyle.ts'
import HoneycombStyle from './HoneycombStyle.ts'
import LancetStyle from './LancetStyle.ts'
import LatticeStyle from './LatticeStyle.ts'
import {point, reach, translate, unite} from './lib/polygons.ts'
import LouverStyle from './LouverStyle.ts'
import {forcedOpenings, openingStyleIds} from './openingParameter.ts'
import PerforatedStyle from './PerforatedStyle.ts'
import RingStyle from './RingStyle.ts'
import RoseStyle from './RoseStyle.ts'
import SlitStyle from './SlitStyle.ts'
import SunburstStyle from './SunburstStyle.ts'
import SunflowerStyle from './SunflowerStyle.ts'
import VoronoiStyle from './VoronoiStyle.ts'

export type {OpeningStyleId} from './openingParameter.ts'

/** every kind of openings, by id */
export const openingStyles = {
  coffers: new CofferStyle,
  constellation: new ConstellationStyle,
  crescent: new CrescentStyle,
  foils: new FoilStyle,
  girih: new GirihStyle,
  honeycomb: new HoneycombStyle,
  lancets: new LancetStyle,
  lattice: new LatticeStyle,
  louvers: new LouverStyle,
  perforated: new PerforatedStyle,
  rings: new RingStyle,
  rose: new RoseStyle,
  slits: new SlitStyle,
  sunburst: new SunburstStyle,
  sunflower: new SunflowerStyle,
  voronoi: new VoronoiStyle,
} as const satisfies Record<OpeningStyleId, OpeningStyle>

/** the kind of openings the default seed’s ceiling is cut with */
export const defaultOpeningStyle: OpeningStyleId = 'coffers'
/** the chain of rolls that cuts the default seed’s openings instead of the seed’s own, picked among the coffers it allows: six by six coffers over the whole ceiling, each pierced by three by three openings about 27 cm square */
export const defaultVariant = 98

/** the openings cut through the Studio’s ceiling, relative to the room’s origin, and where the light they let in lands */
export type StudioOpenings = {
  /** the holes, x along the room’s x and y along its z */
  holes: Polygons
  /** the middle of the holes */
  middle: Point
  /** the middle of the light they cast down at the floor’s height, the same pattern shifted away from the light, which the walls catch where it reaches past them */
  pool: Point
  style: OpeningStyleId
}

/** The kind of openings the Studio’s ceiling is cut with in the environment of `seed`, without cutting them. */
export function studioOpeningStyle(seed: number, forced: OpeningStyleId | '' = forcedOpenings): OpeningStyleId {
  return rolledStyle(seed, forced).style
}

/**
 * The openings of the Studio’s ceiling in the environment of `seed`, the light falling through them from `toLight`: a kind of openings the seed rolls, see {@link studioOpeningStyle}, spread over the whole ceiling of `plan` inside its rim, wherever the seed puts them within any of it they leave over.
 * The default seed puts them right in the ceiling’s middle. A `variant` other than 0 cuts them by a chain of rolls of its own instead of the seed’s.
 */
export function studioOpenings(seed: number, toLight: Vec3, forced: OpeningStyleId | '' = forcedOpenings, {plan = studioPlan(seed), variant = 0}: {
  /** the room whose ceiling they are cut through, the seed’s by default */
  plan?: StudioPlan
  variant?: number
} = {}): StudioOpenings {
  const {rolls, style} = rolledStyle(seed, forced, variant)
  const {clear, height} = plan
  // A millimeter short, which Clipper’s rounding to a tenth of one never makes up.
  const [x, y] = openingSpread(clear).map(spread => spread - 0.001)
  const pattern = unite(openingStyles[style].make(rolls.child(style), {
    x,
    y,
  }))
  const extent = reach(pattern)
  const [middleX, middleY] = ([[extent.x, x], [extent.y, y]] as const).map(([extending, spread], axis) => {
    // Anywhere the ceiling leaves room, toward its middle rather than its ends, by the average of two rolls.
    const along = isDefaultSeed(seed) ? 0.5 : (rolls.between(['place', axis, 0], 0, 1) + rolls.between(['place', axis, 1], 0, 1)) / 2
    return (spread - extending) * (along * 2 - 1)
  })
  const shift = ceilingShift(toLight, height + studioSlab)
  const middle = point(middleX, middleY)
  const pool = point(middleX - shift[0], middleY - shift[1])
  return {
    holes: translate(pattern, middle),
    middle,
    pool,
    style,
  }
}

/** The rolls the openings of the Studio’s ceiling are cut by in the environment of `seed`, those of `variant` unless it is 0, the default seed’s own chosen ones, see {@link defaultVariant}, and the kind of openings they roll, {@link defaultOpeningStyle} for the default seed, unless `forced` names one. */
function rolledStyle(seed: number, forced: OpeningStyleId | '', variant = 0) {
  const chain = variant ? ['studio', 'openings', 'variant', variant] : (isDefaultSeed(seed) ? ['studio', 'openings', 'variant', defaultVariant] : ['studio', 'openings'])
  const rolls = new Rolls(environmentRandom(seed).makeChild(chain))
  const style = forced || (isDefaultSeed(seed) ? defaultOpeningStyle : rolls.item('style', openingStyleIds, openingStyleIds.map(id => openingStyles[id].weight)))
  return {
    rolls,
    style,
  }
}
