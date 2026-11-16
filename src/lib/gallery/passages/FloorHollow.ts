import type {FloorPolygon} from '../floorPolygons.ts'
import type {FloorRectangle} from '../floors.ts'

import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import {wallFace} from '../architectureDimensions.ts'
import {cutFloorOpening} from '../floorPolygons.ts'

/** the opening down to the floor a hollow sinks toward, in a wall running east and west or north and south */
export type HollowOutlet = {
  /** the middle of the opening on the wall’s center line, in plan */
  center: Point
  /** half the opening’s width between its jambs */
  half: number
  /** the direction through the opening from the floor the hollow sinks into, one of the four points of the compass */
  into: Point
}

export type HollowShape = {
  /** how far beyond the wall’s center line its lowest point lies, in the opening */
  beyond: number
  /** how deep it sinks at its lowest point */
  depth: number
  /** how far out from its lowest point it reaches, toward the floor in front of the wall */
  reach: number
  /** how fast it widens out beyond its throat on its left and its right, seen facing into the opening, in meters across for every meter out from the wall’s face */
  spread: readonly [left: number, right: number]
  /** how far out from the opening’s middle it reaches across along the wall, on either side: at most half the opening’s width */
  throat: number
  /** how far out from the opening’s middle it reaches across at most, on its left and its right */
  width: readonly [left: number, right: number]
}
export type HollowOptions = {
  /** the rectangle of the floor its surface takes the place of, which has to take in all of the hollow: the hollow’s own footprint if left out */
  area?: FloorRectangle
  /** how far under `y` the floor round it lies at a point in plan, like a crossfall falling toward the opening, which the hollow sinks into further: level if left out */
  sag?: (x: number, z: number) => number
}
type Point = readonly [x: number, z: number]

/** how finely its surface is cut, in meters: at this step its smooth sink’s triangles still follow the ideal surface to a fraction of a millimeter, and every knot of its seam is one of the adjoining floor’s outlet profile, whose grid follows suit */
const step = 0.12
/** how far below the seam’s deepest point the adjoining floor’s datum lies */
const outletStep = 0.02
/** a bump from 1 in its middle down to 0, smoothly, at ±1 and beyond */
const bump = (s: number) => (Math.abs(s) < 1 ? (1 - s * s) ** 2 : 0)

/**
 * A hollow the paving of a floor at `y` has sunk into in front of an opening down to the floor, deepest just beyond the opening, as though water had long drained off through it: whatever rolls across it runs down into the opening.
 * It sinks nowhere beyond its throat along the wall, so the walls beside the opening keep standing on the floor; in front of the wall it widens out as far as its `spread` lets it.
 * Floors it lies in lose the rectangle its surface takes up, see {@link FloorHollow.cut}, and its surface is a geometry of its own, see {@link FloorHollow.geometry}.
 */
export default class FloorHollow {
  /** the rectangle its surface takes up in plan */
  readonly footprint: FloorRectangle
  /** the datum for the floor beyond the opening, a little below the deepest point of the seam; blend its outlet profile into that floor */
  readonly outletY: number
  /** the direction to the right of `into`, seen from above with north up */
  private readonly right: Point
  private readonly sagAt: (x: number, z: number) => number

  constructor(readonly y: number, readonly outlet: HollowOutlet, readonly shape: HollowShape, {area, sag = () => 0}: HollowOptions = {}) {
    const {into: [ix, iz], half} = outlet
    if (Math.abs(Math.abs(ix) + Math.abs(iz) - 1) > 1e-9 || ix * iz !== 0) {
      throw new RangeError('A hollow sinks toward an opening through a wall running along a point of the compass.')
    }
    if (!(shape.depth > 0 && shape.reach > shape.beyond && shape.beyond >= 0 && shape.throat > 0 && shape.throat <= half && shape.width.every(width => width >= shape.throat))) {
      throw new RangeError('A hollow needs a depth, a throat within its opening and at most as wide as itself, and to reach out in front of its wall.')
    }
    this.right = [-iz, ix]
    this.sagAt = sag
    // From the wall’s center line out to where it ends, from its left edge to its right.
    const out = shape.reach - shape.beyond
    const corners = [this.at(-this.wide(0, out), 0), this.at(this.wide(1, out), out)]
    const min = [Math.min(corners[0][0], corners[1][0]), Math.min(corners[0][1], corners[1][1])]
    const max = [Math.max(corners[0][0], corners[1][0]), Math.max(corners[0][1], corners[1][1])]
    this.footprint = area ?? {
      center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2],
      size: [max[0] - min[0], max[1] - min[1]],
    }
    const {center: [ax, az], size: [aw, ad]} = this.footprint
    if (min[0] < ax - aw / 2 - 1e-9 || max[0] > ax + aw / 2 + 1e-9 || min[1] < az - ad / 2 - 1e-9 || max[1] > az + ad / 2 + 1e-9) {
      throw new RangeError('A hollow’s surface has to take in all of the hollow.')
    }
    const segments = Math.ceil(half * 2 / step)
    const deepest = Math.max(...Array.from({length: segments + 1}, (_, segment) => this.sink(...this.at(-half + half * 2 * segment / segments, 0))))
    this.outletY = y - deepest - outletStep
  }

  /** The convex pieces of the polygon outside its surface’s rectangle. */
  cut(polygon: FloorPolygon) {
    return cutFloorOpening(polygon, this.footprint)
  }

  /** The height on its visible triangles, or undefined outside its footprint. */
  floorAt(x: number, z: number) {
    const {center: [cx, cz], size: [width, depth]} = this.footprint
    const columns = Math.ceil(width / step)
    const rows = Math.ceil(depth / step)
    const across = (x - cx + width / 2) / width * columns
    const along = (z - cz + depth / 2) / depth * rows
    if (across < -1e-9 || across > columns + 1e-9 || along < -1e-9 || along > rows + 1e-9) {
      return
    }
    const column = Math.min(Math.max(Math.floor(across), 0), columns - 1)
    const row = Math.min(Math.max(Math.floor(along), 0), rows - 1)
    const u = Math.min(Math.max(across - column, 0), 1)
    const t = Math.min(Math.max(along - row, 0), 1)
    const at = (c: number, r: number) => this.y - this.sink(cx - width / 2 + width * c / columns, cz - depth / 2 + depth * r / rows)
    const [a, b, c, d] = [at(column, row), at(column + 1, row), at(column, row + 1), at(column + 1, row + 1)]
    return t + u <= 1 ? a + (b - a) * u + (c - a) * t : d + (c - d) * (1 - u) + (b - d) * (1 - t)
  }

  /**
   * Its surface, facing up, in world space, with the paving’s metric UVs. The adjoining floor must match its outlet profile; no vertical drop face slices across their join.
   */
  geometry() {
    const {center: [cx, cz], size: [width, depth]} = this.footprint
    const columns = Math.ceil(width / step)
    const rows = Math.ceil(depth / step)
    const positions: Array<number> = []
    const indices: Array<number> = []
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        const x = cx - width / 2 + width * column / columns
        const z = cz - depth / 2 + depth * row / rows
        positions.push(x, this.y - this.sink(x, z), z)
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column
        const b = a + 1
        const c = a + columns + 1
        const d = c + 1
        // Wound to face up: x runs east, the rows south.
        indices.push(a, c, b, b, c, d)
      }
    }
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const uv: Array<number> = []
    for (let i = 0; i < positions.length; i += 3) {
      uv.push(positions[i], -positions[i + 2])
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }

  /** How far the hollow alone has sunk at the point in plan, under the floor round it: nowhere beyond its throat along the wall, deepest just beyond the opening. */
  hollowAt(x: number, z: number) {
    const {center: [cx, cz], into: [ix, iz]} = this.outlet
    const {beyond, depth, reach} = this.shape
    // How far out in front of the wall’s center line, and how far to the right of the opening’s middle
    const out = -((x - cx) * ix + (z - cz) * iz)
    const across = (x - cx) * this.right[0] + (z - cz) * this.right[1]
    return depth * bump(across / this.wide(across < 0 ? 0 : 1, out)) * bump((out + beyond) / reach)
  }

  /** Every knot of the surface’s seam, with its grade through the outlet, across a span between wall center lines. */
  outletProfile(half: number) {
    const axis = this.right[0] === 0 ? 1 : 0
    const {center, size} = this.footprint
    const normalAxis = 1 - axis
    if (!Number.isFinite(half) || half <= 0 || Math.abs(Math.abs(this.outlet.center[normalAxis] - center[normalAxis]) - size[normalAxis] / 2) > 1e-9) {
      throw new RangeError('A hollow’s outlet profile needs a positive half width and an outlet on its surface’s edge.')
    }
    const count = Math.ceil(size[axis] / step)
    const samples = Array.from({length: count + 1}, (_, i) => (center[axis] - size[axis] / 2 + size[axis] * i / count - this.outlet.center[axis]) / this.right[axis]).filter(across => across > -half && across < half)
    const rowDepth = size[normalAxis] / Math.ceil(size[normalAxis] / step)
    return [-half, ...samples, half].toSorted((a, b) => a - b).map(across => {
      const [x, z] = this.at(across, 0)
      const y = this.floorAt(x, z)
      const before = this.floorAt(x - this.outlet.into[0] * rowDepth, z - this.outlet.into[1] * rowDepth)
      if (y === undefined || before === undefined) {
        throw new RangeError('A hollow’s outlet profile must lie on its surface’s edge, with paving immediately before it.')
      }
      return [across, y, (y - before) / rowDepth] as const
    })
  }

  /** How far under `y` its surface lies at the point in plan: the floor’s own sag round it and the hollow sunk into that. */
  sink(x: number, z: number) {
    return this.sagAt(x, z) + this.hollowAt(x, z)
  }

  /** The point in plan `across` meters to the right of the opening’s middle and `out` meters out in front of the wall’s center line. */
  private at(across: number, out: number): Point {
    const {center: [cx, cz], into: [ix, iz]} = this.outlet
    return [cx + this.right[0] * across - ix * out, cz + this.right[1] * across - iz * out]
  }

  /** How far out from the opening’s middle it reaches across on its left (0) or its right (1), `out` meters out in front of the wall’s center line: as wide as its throat up to the wall’s face, then widening out as fast as it spreads, to its full width. */
  private wide(side: 0 | 1, out: number) {
    const {spread, throat, width} = this.shape
    return Math.min(throat + Math.max(0, out - wallFace) * spread[side], width[side])
  }
}
