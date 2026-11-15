export type FloorBlendProfile = {
  length: number
  /** world-space floor heights in order from the left wall’s center line to the right one’s, including every bend of the adjoining floor */
  profile: ReadonlyArray<readonly [right: number, y: number]>
}

/**
 * Shared validation and triangle-matched interpolation for a floor profile that blends into or out of a passage’s own floor.
 * Queries interpolate the exact mesh triangles rather than a bilinear surface that would stand slightly above or below the mesh between its vertices.
 */
export default abstract class PassageFloorBlend {
  readonly across: ReadonlyArray<number>
  abstract readonly along: ReadonlyArray<number>
  protected abstract readonly rows: ReadonlyArray<ReadonlyArray<number>>

  protected constructor(width: number, {length, profile}: FloorBlendProfile) {
    if (!Number.isFinite(length) || length <= 0 || profile.length < 2 || profile.some(([right, y], index) => !Number.isFinite(right) || !Number.isFinite(y) || index > 0 && right <= profile[index - 1][0]) || Math.abs(profile[0][0] + width / 2) > 1e-9 || Math.abs(profile.at(-1)![0] - width / 2) > 1e-9) {
      throw new RangeError('A floor blend needs a positive length and an ordered, finite height profile spanning both walls.')
    }
    this.across = profile.map(([right]) => right)
  }

  abstract height(along: number, right: number): number

  /** Height on the swept mesh’s triangles, with the sweep’s diagonal from the next column in the first row to the current column in the next row. */
  protected interpolate(along: number, right: number) {
    const nextRow = this.along.findIndex(value => value >= along)
    const row = nextRow === -1 ? this.along.length - 2 : Math.max(0, nextRow - 1)
    const nextColumn = this.across.findIndex(value => value >= right)
    const column = nextColumn === -1 ? this.across.length - 2 : Math.max(0, nextColumn - 1)
    const t = Math.min(Math.max((along - this.along[row]) / (this.along[row + 1] - this.along[row]), 0), 1)
    const u = Math.min(Math.max((right - this.across[column]) / (this.across[column + 1] - this.across[column]), 0), 1)
    const [a, b] = [this.rows[row][column], this.rows[row][column + 1]]
    const [c, d] = [this.rows[row + 1][column], this.rows[row + 1][column + 1]]
    return t + u <= 1 ? a + (b - a) * u + (c - a) * t : d + (c - d) * (1 - u) + (b - d) * (1 - t)
  }
}
