/** world-space floor heights across a passage, in order from the left wall’s center line to the right one’s, each at its distance right of the centerline */
export type FloorHeightProfile = ReadonlyArray<readonly [right: number, y: number]>

/**
 * A passage floor laid out on a grid of rows along its route and columns across it, between which its heights run straight on the triangles its paving is swept from.
 * Queries interpolate those same triangles, along the sweep’s diagonal from the next column in a row to the current column in the next, rather than a smooth surface that would stand slightly above or below the mesh between its vertices.
 */
export default abstract class PassageFloorProfile {
  /** the distances right of the centerline its columns stand at, from the left wall’s center line to the right one’s */
  readonly across: ReadonlyArray<number>

  protected constructor(width: number, profile: FloorHeightProfile, readonly along: ReadonlyArray<number>, private readonly rows: ReadonlyArray<ReadonlyArray<number>>) {
    if (!(width > 0) || profile.length < 2 || profile.some(([right, y], index) => !Number.isFinite(right) || !Number.isFinite(y) || index > 0 && right <= profile[index - 1][0]) || Math.abs(profile[0][0] + width / 2) > 1e-9 || Math.abs(profile.at(-1)![0] - width / 2) > 1e-9 || along.length < 2 || along.some((value, index) => !Number.isFinite(value) || index > 0 && value <= along[index - 1]) || rows.length !== along.length || rows.some(row => row.length !== profile.length || row.some(value => !Number.isFinite(value)))) {
      throw new RangeError('A floor profile needs an ordered, finite height profile spanning both walls and a matching grid of finite rows along the route.')
    }
    this.across = profile.map(([right]) => right)
  }

  /** The height on the grid’s triangles, held at its edges beyond them. */
  protected gridHeight(along: number, right: number) {
    const row = along >= this.along.at(-1)! ? this.along.length - 2 : Math.max(0, this.along.findIndex(value => value >= along) - 1)
    const nextColumn = this.across.findIndex(value => value >= right)
    const column = nextColumn === -1 ? this.across.length - 2 : Math.max(0, nextColumn - 1)
    const t = Math.min(Math.max((along - this.along[row]) / (this.along[row + 1] - this.along[row]), 0), 1)
    const u = Math.min(Math.max((right - this.across[column]) / (this.across[column + 1] - this.across[column]), 0), 1)
    const [a, b] = [this.rows[row][column], this.rows[row][column + 1]]
    const [c, d] = [this.rows[row + 1][column], this.rows[row + 1][column + 1]]
    return t + u <= 1 ? a + (b - a) * u + (c - a) * t : d + (c - d) * (1 - u) + (b - d) * (1 - t)
  }

  /** The floor’s height `along` meters down the route and `right` meters right of its centerline. */
  abstract height(along: number, right: number): number
}
