import type {FloorHeightProfile} from './PassageFloorProfile.ts'
import type PassageRoute from './PassageRoute.ts'

import easedRamp, {easedRampKnots} from '../easedRamp.ts'
import PassageFloorProfile from './PassageFloorProfile.ts'

/** A straight passage’s floor at its mouth, sampled from the floor it joins, blending back into its route’s floor over `length` meters. */
export type FloorInlet = {
  length: number
  /** world-space floor heights in order from the left wall’s center line to the right one’s, including every bend of the adjoining floor */
  profile: FloorHeightProfile
}

function inletGrid(route: PassageRoute, width: number, inlet: FloorInlet) {
  const {length, profile} = inlet
  if (!Number.isFinite(length) || length <= 0 || route.pieces[0].kind !== 'line' || length > route.pieces[0].length || profile.length < 2 || profile.some(([right, y], index) => !Number.isFinite(right) || !Number.isFinite(y) || index > 0 && right <= profile[index - 1][0]) || Math.abs(profile[0][0] + width / 2) > 1e-9 || Math.abs(profile.at(-1)![0] - width / 2) > 1e-9) {
    throw new RangeError('A floor inlet needs a positive length within the first straight run and an ordered, finite height profile spanning both walls.')
  }
  const along = [...route.stations(0, length, 1 / 32).map(station => station.along), ...easedRampKnots(length)].toSorted((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9)
  const rows = along.map(distance => {
    const y = route.at(distance).y
    const remaining = 1 - easedRamp(distance, length)
    return profile.map(([, inletY]) => y + (inletY - route.y) * remaining)
  })
  return {
    along,
    rows,
  }
}

/**
 * A floor that starts tilted across to match an adjoining ramp, then eases back into its own route’s floor. The vault stays on the original route.
 * Its profile supplies the paving’s columns and its easing supplies extra rows.
 */
export default class PassageFloorInlet extends PassageFloorProfile {
  readonly inlet: FloorInlet
  readonly route: PassageRoute

  constructor(route: PassageRoute, width: number, inlet: FloorInlet) {
    const {along, rows} = inletGrid(route, width, inlet)
    super(width, inlet.profile, along, rows)
    this.route = route
    this.inlet = inlet
  }

  override height(along: number, right: number) {
    if (along >= this.inlet.length) {
      return this.route.at(along).y
    }
    return this.gridHeight(along, right)
  }
}
