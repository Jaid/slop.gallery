import type {Wall} from '../../placement/wallGeometry.ts'
import type {FloorPolygon} from '../floorPolygons.ts'

import {curveSegments} from '../CurvedBoxGeometry.ts'

/** what a wall of a bend takes from its stairway: its id and room, how high it stands and how it is trimmed */
export type StairBendWall = Pick<Wall, 'height' | 'id' | 'room'> & Partial<Pick<Wall, 'curveTolerance' | 'sticky' | 'trimStyle'>>

type Point = readonly [x: number, z: number]

const rightOf = ([hx, hz]: Point): Point => [-hz, hx]

/**
 * A level stretch of a stairway that turns along a circular arc between two straight runs, like a bend in a corridor: its floor as convex facets, its two curved walls and its centerline.
 * Plan coordinates are x and z, with the right of a heading `(hx, hz)` being `(−hz, hx)`; a positive `sweep` turns right, a negative one left.
 */
export default class StairBend {
  /** the middle of the circle the centerline follows */
  readonly center: Point
  /** where the centerline ends */
  readonly end: Point
  /** the unit heading at the end */
  readonly endHeading: Point
  /** how long the centerline is, in meters */
  readonly length: number
  /** 1 for a bend to the right, −1 for one to the left */
  private readonly turn: number

  constructor(readonly start: Point, readonly heading: Point, readonly radius: number, readonly sweep: number, readonly width: number, readonly floor: number) {
    if (![...start, ...heading, radius, sweep, width, floor].every(Number.isFinite) || Math.abs(Math.hypot(...heading) - 1) > 1e-9 || !(width > 0) || !(radius > width / 2) || sweep === 0 || Math.abs(sweep) > Math.PI) {
      throw new RangeError('A stair bend needs a unit heading, a positive width, a radius beyond its inner wall and a turn of up to half a revolution.')
    }
    this.turn = Math.sign(sweep)
    const [rx, rz] = rightOf(heading)
    this.center = [start[0] + this.turn * radius * rx, start[1] + this.turn * radius * rz]
    this.end = this.point(1)
    this.endHeading = this.headingAt(1)
    this.length = radius * Math.abs(sweep)
  }

  /** How many facets keep the outer edge’s chords within `tolerance` meters of its arc. */
  facetCount(tolerance: number) {
    const outer = this.radius + this.width / 2
    return Math.max(1, Math.ceil(Math.abs(this.sweep) / (2 * Math.acos(1 - tolerance / outer)) - 1e-9))
  }

  /** The level floor’s facets: convex quadrilaterals between `count + 1` stations from the start to the end, each from its left edge round to its right one. */
  facets(count: number): Array<FloorPolygon> {
    const stations = this.stations(count)
    return stations.slice(1).map(([left, right], index) => [stations[index][0], left, right, stations[index][1]])
  }

  /** The unit heading of the centerline at the share `t` of its length. */
  headingAt(t: number): Point {
    const angle = this.sweep * t
    const [hx, hz] = this.heading
    const [rx, rz] = rightOf(this.heading)
    const along = Math.cos(Math.abs(angle))
    const aside = this.turn * Math.sin(Math.abs(angle))
    return [hx * along + rx * aside, hz * along + rz * aside]
  }

  /** The point at the share `t` of the centerline’s length, `across` meters to its right. */
  point(t: number, across = 0): Point {
    const [rx, rz] = rightOf(this.headingAt(t))
    const reach = this.radius - this.turn * across
    return [this.center[0] - this.turn * reach * rx, this.center[1] - this.turn * reach * rz]
  }

  /** The bend’s left and right edges at `count + 1` evenly spaced stations, from the start to the end; the edges run along the middle of its walls. */
  stations(count: number): Array<readonly [left: Point, right: Point]> {
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new RangeError('A stair bend needs a whole number of facets.')
    }
    return Array.from({length: count + 1}, (_, index) => [this.point(index / count, -this.width / 2), this.point(index / count, this.width / 2)] as const)
  }

  /**
   * The wall along its left (`side` −1) or right (`side` 1) edge, standing on the floor and facing back across the bend, curved round its center: concave on the outside of the turn, convex on the inside.
   * Its foot runs along the edge, see {@link stations}, and its faces are cut into facets to its `curveTolerance`.
   */
  wall(side: -1 | 1, wall: StairBendWall): Wall {
    const [mx, mz] = this.point(0.5, side * this.width / 2)
    const [hx, hz] = this.headingAt(0.5)
    // It faces back across the bend: the left wall to the right of the heading, the right wall to its left.
    const [nx, nz] = rightOf([-side * hx, -side * hz])
    const reach = this.radius - this.turn * side * this.width / 2
    return {
      sticky: false,
      ...wall,
      center: [mx, this.floor, mz],
      rotation: Math.atan2(nx, nz),
      width: reach * Math.abs(this.sweep),
      // Positive where the bend’s center lies in front of the wall, which is the outside of the turn.
      curveRadius: -this.turn * side * reach,
    }
  }

  /** How many facets a wall of the bend is cut into with the tolerance, see {@link curveSegments}. */
  wallFacets(side: -1 | 1, tolerance?: number) {
    const reach = this.radius - this.turn * side * this.width / 2
    return curveSegments(reach * Math.abs(this.sweep), reach, tolerance)
  }
}
