import type {RouteStation} from './PassageRoute.ts'
import type PassageRoute from './PassageRoute.ts'

import pavingColumns from './pavingColumns.ts'

/** A floor joined across the route’s end, spilling back into the passage before returning to its ordinary paving. */
export type FloorOutlet = {
  /** the stretch at the route’s end to tessellate; it must contain the whole blend, including around a tight inside corner */
  length: number
  /** heights and grades into the passage, from the left wall’s center line to the right one’s, sampled from the adjoining floor */
  profile: ReadonlyArray<readonly [right: number, y: number, grade: number]>
  /** how far the shape spills into the passage, measured in world meters from the end segment, not around the route’s centerline */
  reach: number
}
type Point = readonly [x: number, z: number]
type Vertex = readonly [x: number, y: number, z: number]
const step = 0.06
const place = ({point: [x, z], heading}: RouteStation, right: number): Point => [x - Math.sin(heading) * right, z + Math.cos(heading) * right]
/** The interval containing a value, including tolerated roundoff just beyond either endpoint. */
const interval = (values: ReadonlyArray<number>, value: number) => {
  const next = values.findIndex(offset => offset >= value)
  return next === -1 ? values.length - 2 : Math.max(0, next - 1)
}
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

/**
 * A tangent-matched floor blend near a route’s end. Distance to the end segment keeps the blend gentle even around a tiny-radius inside wall, carrying it into the preceding run if needed.
 * The sampled rows drive the mesh and triangle-interpolated height queries alike. The vault remains on the original route.
 */
export default class PassageFloorOutlet {
  readonly across: ReadonlyArray<number>
  readonly along: ReadonlyArray<number>
  readonly from: number
  private readonly normalHeight: (station: RouteStation, right: number) => number
  private readonly rows: ReadonlyArray<ReadonlyArray<Vertex>>

  constructor(readonly route: PassageRoute, width: number, readonly outlet: FloorOutlet, base: (station: RouteStation, right: number) => number, stations: ReadonlyArray<RouteStation>) {
    const {length, profile: supplied, reach} = outlet
    const profile = supplied.map(([right, y, grade], index) => [index === 0 ? -width / 2 : (index === supplied.length - 1 ? width / 2 : right), y, grade] as const)
    if (!Number.isFinite(length) || length <= 0 || length > route.length || !Number.isFinite(reach) || reach <= 0 || supplied.length < 2 || profile.some(([right], index) => index > 0 && right <= profile[index - 1][0]) || supplied.some((values, index) => values.some(value => !Number.isFinite(value)) || index > 0 && values[0] <= supplied[index - 1][0]) || Math.abs(supplied[0][0] + width / 2) > 1e-9 || Math.abs(supplied.at(-1)![0] - width / 2) > 1e-9) {
      throw new RangeError('A floor outlet needs a finite positive reach, a length within its route and an ordered, finite height and grade profile spanning both walls.')
    }
    this.from = route.length - length
    const offsets = profile.map(([right]) => right)
    const ordinary = pavingColumns(width)
    this.across = [...ordinary, ...offsets].toSorted((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9)
    // Subdivide the existing intervals rather than overlaying a second grid that makes needle-thin slivers.
    this.along = stations.flatMap(({along}, index) => {
      if (index === stations.length - 1) {
        return along
      }
      const span = stations[index + 1].along - along
      const count = Math.ceil(span / step)
      return Array.from({length: count}, (_, i) => along + span * i / count)
    })
    const end = route.end
    const forward: Point = [Math.cos(end.heading), Math.sin(end.heading)]
    const rightAxis: Point = [-forward[1], forward[0]]
    // Retain the ordinary paving’s crosswise facets at the upstream join, including the strips under its walls.
    this.normalHeight = (station: RouteStation, right: number) => {
      const i = interval(ordinary, right)
      const u = clamp((right - ordinary[i]) / (ordinary[i + 1] - ordinary[i]), 0, 1)
      return base(station, ordinary[i]) * (1 - u) + base(station, ordinary[i + 1]) * u
    }
    this.rows = this.along.map((along, row) => {
      const station = route.at(along)
      return this.across.map((right): Vertex => {
        const [x, z] = place(station, right)
        const lateral = (x - end.point[0]) * rightAxis[0] + (z - end.point[1]) * rightAxis[1]
        const closest = clamp(lateral, -width / 2, width / 2)
        const distance = Math.hypot(x - end.point[0] - rightAxis[0] * closest, z - end.point[1] - rightAxis[1] * closest)
        const t = clamp(distance / reach, 0, 1)
        const i = interval(offsets, closest)
        const u = clamp((closest - profile[i][0]) / (profile[i + 1][0] - profile[i][0]), 0, 1)
        const y = this.normalHeight(station, right)
        const seamY = profile[i][1] * (1 - u) + profile[i + 1][1] * u
        const delta = seamY - y
        // Monotone Hermite blend: no overshoot, dam or new pocket beside the hatch.
        const grade = clamp(profile[i][2] * (1 - u) + profile[i + 1][2] * u, Math.min(-3 * delta / reach, 0), Math.max(-3 * delta / reach, 0))
        if (row === 0 && distance < reach - 1e-9) {
          throw new RangeError('A floor outlet’s tessellated stretch must contain its entire blend.')
        }
        const correction = delta * (1 - 3 * t * t + 2 * t ** 3) + reach * grade * t * (1 - t) ** 2
        // Preserve the exact supplied seam heights, including at the walls.
        return [x, row === this.along.length - 1 ? seamY : y + correction, z]
      })
    })
  }

  /** The height on the swept paving’s actual planar triangles, not on an ideal arc or bilinear quad. */
  height(station: RouteStation, right: number) {
    if (station.along < this.from) {
      return this.normalHeight(station, right)
    }
    const [x, z] = place(station, right)
    const row = interval(this.along, station.along)
    let nearest = -Infinity
    let height = 0
    for (let column = 0; column < this.across.length - 1; column++) {
      const [a, b] = [this.rows[row][column], this.rows[row][column + 1]]
      const [c, d] = [this.rows[row + 1][column], this.rows[row + 1][column + 1]]
      for (const [p, q, r] of [[a, b, c], [b, d, c]]) {
        const denominator = (q[2] - r[2]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[2] - r[2])
        const u = ((q[2] - r[2]) * (x - r[0]) + (r[0] - q[0]) * (z - r[2])) / denominator
        const v = ((r[2] - p[2]) * (x - r[0]) + (p[0] - r[0]) * (z - r[2])) / denominator
        const w = 1 - u - v
        const inside = Math.min(u, v, w)
        if (inside > nearest) {
          nearest = inside
          height = u * p[1] + v * q[1] + w * r[1]
        }
        if (inside >= -1e-9) {
          return height
        }
      }
    }
    // The ideal arc can lie a fraction of a millimeter outside its polygonal edge. Extend the nearest triangle to it, as the wall’s baseboard does.
    return height
  }
}
