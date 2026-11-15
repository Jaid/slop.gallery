import type PassageRoute from './PassageRoute.ts'

import easedRamp, {easedRampKnots} from '../easedRamp.ts'

/** A straight passage’s floor at its mouth, sampled from the floor it joins, blending back into its route’s floor over `length` meters. */
export type FloorInlet = {
  length: number
  /** world-space floor heights in order from the left wall’s center line to the right one’s, including every bend of the adjoining floor */
  profile: ReadonlyArray<readonly [right: number, y: number]>
}

/**
 * A floor that starts tilted across to match an adjoining ramp, then eases back into its own route’s floor. The vault stays on the original route.
 * Its profile supplies the paving’s columns and its easing supplies extra rows. Queries interpolate those same triangles, rather than a bilinear surface that would stand slightly above or below the mesh between its vertices.
 */
export default class PassageFloorInlet {
  readonly across: ReadonlyArray<number>
  readonly along: ReadonlyArray<number>
  private readonly rows: ReadonlyArray<ReadonlyArray<number>>

  constructor(readonly route: PassageRoute, width: number, readonly inlet: FloorInlet) {
    const {length, profile} = inlet
    if (!Number.isFinite(length) || length <= 0 || route.pieces[0].kind !== 'line' || length > route.pieces[0].length || profile.length < 2 || profile.some(([right, y], index) => !Number.isFinite(right) || !Number.isFinite(y) || index > 0 && right <= profile[index - 1][0]) || Math.abs(profile[0][0] + width / 2) > 1e-9 || Math.abs(profile.at(-1)![0] - width / 2) > 1e-9) {
      throw new RangeError('A floor inlet needs a positive length within the first straight run and an ordered, finite height profile spanning both walls.')
    }
    this.across = profile.map(([right]) => right)
    this.along = [...route.stations(0, length, 1 / 32).map(station => station.along), ...easedRampKnots(length)].toSorted((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9)
    this.rows = this.along.map(along => {
      const y = route.at(along).y
      const remaining = 1 - easedRamp(along, length)
      return profile.map(([, inletY]) => y + (inletY - route.y) * remaining)
    })
  }

  /** The height on the paving’s triangles, with the sweep’s diagonal from the next column in the first row to the current column in the next row. */
  height(along: number, right: number) {
    if (along >= this.inlet.length) {
      return this.route.at(along).y
    }
    const row = Math.max(0, this.along.findIndex(value => value >= along) - 1)
    const nextColumn = this.across.findIndex(value => value >= right)
    const column = nextColumn === -1 ? this.across.length - 2 : Math.max(0, nextColumn - 1)
    const t = Math.min(Math.max((along - this.along[row]) / (this.along[row + 1] - this.along[row]), 0), 1)
    const u = Math.min(Math.max((right - this.across[column]) / (this.across[column + 1] - this.across[column]), 0), 1)
    const [a, b] = [this.rows[row][column], this.rows[row][column + 1]]
    const [c, d] = [this.rows[row + 1][column], this.rows[row + 1][column + 1]]
    return t + u <= 1 ? a + (b - a) * u + (c - a) * t : d + (c - d) * (1 - u) + (b - d) * (1 - t)
  }
}
