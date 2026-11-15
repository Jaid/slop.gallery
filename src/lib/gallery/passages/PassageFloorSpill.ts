import type {FloorHeightProfile} from './PassageFloorProfile.ts'
import type PassageRoute from './PassageRoute.ts'
import type {RouteStation} from './PassageRoute.ts'

import easedRamp, {easedRampKnots} from '../easedRamp.ts'
import PassageFloorProfile from './PassageFloorProfile.ts'

/** A passage’s floor at its far end, sampled from the floor beyond it, blending back into its route’s floor over `length` meters. */
export type FloorSpill = {
  length: number
  /** world-space floor heights at the route’s end, in order from the left wall’s center line to the right one’s, including every bend of the adjoining floor */
  profile: FloorHeightProfile
}
/** How high the route’s own floor, its crossfall included, lies at a station and a distance right of its centerline, before a spill is laid over it. */
export type SpillBaseFloor = (station: RouteStation, right: number) => number

function spillGrid(route: PassageRoute, width: number, spill: FloorSpill, base: SpillBaseFloor) {
  const {length, profile} = spill
  if (!Number.isFinite(length) || length <= 0 || length > route.pieces.at(-1)!.length + 1e-9 || profile.length < 2 || profile.some(([right, y], index) => !Number.isFinite(right) || !Number.isFinite(y) || index > 0 && right <= profile[index - 1][0]) || Math.abs(profile[0][0] + width / 2) > 1e-9 || Math.abs(profile.at(-1)![0] - width / 2) > 1e-9) {
    throw new RangeError('A floor spill needs a positive length within the last run or turn and an ordered, finite height profile spanning both walls.')
  }
  const from = route.length - length
  // The route’s stations over its whole last piece, not only over the spill: a turn’s stations are spaced from its start, and the paving follows those, so a grid spaced from the spill’s start would cut across its triangles.
  const along = [...route.stations(route.pieces.at(-1)!.from, route.length, 1 / 32).map(station => station.along).filter(distance => distance >= from - 1e-9), from, ...easedRampKnots(length).map(knot => from + knot)].toSorted((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9)
  const end = route.at(route.length)
  const endBase = profile.map(([right]) => base(end, right))
  const rows = along.map(distance => {
    const station = route.at(distance)
    const spilled = easedRamp(distance - from, length)
    return profile.map(([right, y], index) => base(station, right) + (y - endBase[index]) * spilled)
  })
  return {
    along,
    from,
    rows,
  }
}

/**
 * A floor that ends on the profile of the floor beyond its route’s end, as though that floor’s shape had spilled a little way back into the passage, then eases back into its own route’s floor, crossfall included. The vault stays on the original route.
 * Its profile supplies the paving’s columns over its last stretch and its easing supplies extra rows.
 */
export default class PassageFloorSpill extends PassageFloorProfile {
  /** how far along the route the spill begins, its `length` short of the route’s end */
  readonly from: number
  readonly route: PassageRoute
  readonly spill: FloorSpill
  private readonly base: SpillBaseFloor

  constructor(route: PassageRoute, width: number, spill: FloorSpill, base: SpillBaseFloor) {
    const {along, from, rows} = spillGrid(route, width, spill, base)
    super(width, spill.profile, along, rows)
    this.from = from
    this.route = route
    this.spill = spill
    this.base = base
  }

  override height(along: number, right: number) {
    if (along < this.from) {
      return this.base(this.route.at(along), right)
    }
    return this.gridHeight(along, right)
  }
}
