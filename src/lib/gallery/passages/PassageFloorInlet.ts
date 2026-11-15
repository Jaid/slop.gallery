import type {FloorBlendProfile} from './base/PassageFloorBlend.ts'
import type PassageRoute from './PassageRoute.ts'

import easedRamp, {easedRampKnots} from '../easedRamp.ts'
import PassageFloorBlend from './base/PassageFloorBlend.ts'

/** A straight passage’s floor at its mouth, sampled from the floor it joins, blending back into its route’s floor over `length` meters. */
export type FloorInlet = FloorBlendProfile

/**
 * A floor that starts tilted across to match an adjoining ramp, then eases back into its own route’s floor. The vault stays on the original route.
 * Its profile supplies the paving’s columns and its easing supplies extra rows.
 */
export default class PassageFloorInlet extends PassageFloorBlend {
  readonly along: ReadonlyArray<number>
  protected readonly rows: ReadonlyArray<ReadonlyArray<number>>

  constructor(readonly route: PassageRoute, width: number, readonly inlet: FloorInlet) {
    super(width, inlet)
    const {length, profile} = inlet
    if (route.pieces[0].kind !== 'line' || length > route.pieces[0].length) {
      throw new RangeError('A floor inlet needs a length within the passage’s first straight run.')
    }
    this.along = [...route.stations(0, length, 1 / 32).map(station => station.along), ...easedRampKnots(length)].toSorted((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9)
    this.rows = this.along.map(along => {
      const y = route.at(along).y
      const remaining = 1 - easedRamp(along, length)
      return profile.map(([, inletY]) => y + (inletY - route.y) * remaining)
    })
  }

  /** The height on the paving’s triangles within the inlet, or on the route beyond it. */
  height(along: number, right: number) {
    if (along >= this.inlet.length) {
      return this.route.at(along).y
    }
    return this.interpolate(along, right)
  }
}
