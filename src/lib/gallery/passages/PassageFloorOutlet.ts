import type {RouteStation} from './PassageRoute.ts'
import type PassageRoute from './PassageRoute.ts'

import {clamp} from 'math'

/** A floor joined across the route’s end, spilling back into the passage before returning to its ordinary paving. */
export type FloorOutlet = {
  /** heights and grades into the passage, from the left wall’s center line to the right one’s, sampled from the adjoining floor */
  profile: ReadonlyArray<readonly [right: number, y: number, grade: number]>
  /** how far the shape spills back into the passage, in meters along each lane from the route’s end */
  reach: number
}
type Point = readonly [x: number, z: number]
type Vertex = readonly [x: number, y: number, z: number]
/** how far apart its rows stand at most, in meters along the centerline: the blend bends gently over meters, so it needs no rows as fine as the ones a turn’s walls are cut at, and its eased Hermite strays less than a millimeter from the straights between rows this far apart */
const rowStep = 0.25
const place = ({point: [x, z], heading}: RouteStation, right: number): Point => [x - Math.sin(heading) * right, z + Math.cos(heading) * right]
/** The interval containing a value, including tolerated roundoff just beyond either endpoint. */
const interval = (values: ReadonlyArray<number>, value: number) => {
  const next = values.findIndex(offset => offset >= value)
  return next === -1 ? values.length - 2 : Math.max(0, next - 1)
}

/**
 * A tangent-matched floor blend near a route’s end. Every lane, a line at a fixed distance from the centerline, eases from the seam’s height at its own place across back into the ordinary paving over the same distance along itself, so the blend keeps one gentle grade throughout: round a turn, the lanes toward its center run shorter and carry the blend on into the run before, instead of steepening it into a lip at a tight inside corner.
 * The sampled rows drive the mesh and triangle-interpolated height queries alike. The vault remains on the original route.
 */
export default class PassageFloorOutlet {
  /** How far a lane `right` meters right of the centerline runs from `along` meters down the route to its end: round a turn, a lane toward its center runs shorter than the centerline, one away from it longer. */
  static laneDistance(route: PassageRoute, along: number, right: number) {
    let distance = 0
    for (const piece of route.pieces) {
      const run = piece.from + piece.length - Math.max(along, piece.from)
      if (run > 0) {
        // A clockwise turn has its center on the right.
        distance += run * (piece.kind === 'arc' ? 1 - Math.sign(piece.sweep) * right / piece.radius : 1)
      }
    }
    return distance
  }

  /** How far along the route a blend `reach` meters long along every lane starts: where the lane running shortest from there to the end, along one of the walls, has run that far. */
  static start(route: PassageRoute, width: number, reach: number) {
    if (!Number.isFinite(reach) || reach <= 0 || [-1, 1].some(side => PassageFloorOutlet.laneDistance(route, 0, side * width / 2) < reach)) {
      throw new RangeError('A floor outlet needs a finite positive reach that every lane of its route can run.')
    }
    return Math.min(...[-1, 1].map(side => {
      const right = side * width / 2
      let remaining = reach
      for (const piece of route.pieces.toReversed()) {
        const scale = piece.kind === 'arc' ? 1 - Math.sign(piece.sweep) * right / piece.radius : 1
        if (piece.length * scale >= remaining) {
          return piece.from + piece.length - remaining / scale
        }
        remaining -= piece.length * scale
      }
      return 0
    }))
  }

  readonly across: ReadonlyArray<number>
  readonly along: ReadonlyArray<number>
  /** how far along the route the blend starts, see {@link PassageFloorOutlet.start} */
  readonly from: number
  private readonly normalHeight: (station: RouteStation, right: number) => number
  private readonly rows: ReadonlyArray<ReadonlyArray<Vertex>>

  /** `ordinary` are the columns across the passage’s ordinary paving, from its left wall’s center line to its right one’s, between which its floor runs straight across. */
  constructor(readonly route: PassageRoute, width: number, readonly outlet: FloorOutlet, base: (station: RouteStation, right: number) => number, ordinary: ReadonlyArray<number> = [-width / 2, 0, width / 2]) {
    const {profile: supplied, reach} = outlet
    const profile = supplied.map(([right, y, grade], index) => [index === 0 ? -width / 2 : (index === supplied.length - 1 ? width / 2 : right), y, grade] as const)
    if (supplied.length < 2 || profile.some(([right], index) => index > 0 && right <= profile[index - 1][0]) || supplied.some((values, index) => values.some(value => !Number.isFinite(value)) || index > 0 && values[0] <= supplied[index - 1][0]) || Math.abs(supplied[0][0] + width / 2) > 1e-9 || Math.abs(supplied.at(-1)![0] - width / 2) > 1e-9) {
      throw new RangeError('A floor outlet needs an ordered, finite height and grade profile spanning both walls.')
    }
    if (ordinary.length < 2 || Math.abs(ordinary[0] + width / 2) > 1e-9 || Math.abs(ordinary.at(-1)! - width / 2) > 1e-9 || ordinary.some((value, index) => index > 0 && value <= ordinary[index - 1])) {
      throw new RangeError('A floor outlet’s ordinary columns run in order from one wall to the other.')
    }
    this.from = PassageFloorOutlet.start(route, width, reach)
    const offsets = profile.map(([right]) => right)
    this.across = [...ordinary, ...offsets].toSorted((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9)
    // Between the joints of the route’s pieces and the knots of its ramps, where its floor bends, rather than overlaying a second grid that makes needle-thin slivers.
    const knots = route.stations(this.from, route.length, Math.PI * 2)
    this.along = knots.flatMap(({along}, index) => {
      if (index === knots.length - 1) {
        return along
      }
      const span = knots[index + 1].along - along
      const count = Math.ceil(span / rowStep)
      return Array.from({length: count}, (_, i) => along + span * i / count)
    })
    // Retain the ordinary paving’s crosswise facets at the upstream join, including the strips under its walls.
    this.normalHeight = (station: RouteStation, right: number) => {
      const i = interval(ordinary, right)
      const u = clamp((right - ordinary[i]) / (ordinary[i + 1] - ordinary[i]), 0, 1)
      return base(station, ordinary[i]) * (1 - u) + base(station, ordinary[i + 1]) * u
    }
    // How far the seam stands over or under the ordinary paving at the end, which each lane carries back and eases out, so the route’s own ramp runs on underneath: holding the seam’s height instead would add whatever the ramp falls away over the blend.
    const seam = this.across.map(right => {
      const i = interval(offsets, right)
      const u = clamp((right - profile[i][0]) / (profile[i + 1][0] - profile[i][0]), 0, 1)
      const y = profile[i][1] * (1 - u) + profile[i + 1][1] * u
      const excess = y - this.normalHeight(route.end, right)
      return {
        y,
        excess,
        // Monotone Hermite blend: no overshoot, dam or new pocket beside the hatch.
        grade: clamp(profile[i][2] * (1 - u) + profile[i + 1][2] * u, Math.min(-3 * excess / reach, 0), Math.max(-3 * excess / reach, 0)),
      }
    })
    this.rows = this.along.map((along, row) => {
      const station = route.at(along)
      return this.across.map((right, column): Vertex => {
        const [x, z] = place(station, right)
        const {y, excess, grade} = seam[column]
        const t = clamp(PassageFloorOutlet.laneDistance(route, along, right) / reach, 0, 1)
        // Preserve the exact supplied seam heights, including at the walls.
        return [x, row === this.along.length - 1 ? y : this.normalHeight(station, right) + excess * (1 - 3 * t * t + 2 * t ** 3) + reach * grade * t * (1 - t) ** 2, z]
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
