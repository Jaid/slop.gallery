import type {FloorPolygon} from './floorPolygons.ts'

import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import {baseboardBandFront, baseboardCapFront, baseboardCapHeight, corniceBands, defaultBaseboardHeight, wallFace} from './architectureDimensions.ts'
import lowerGallery, {tunnelBoundary, tunnelDiagonalEast, tunnelDiagonalPoint, tunnelSlopeEndS, tunnelSlopeStartS} from './lowerGallery.ts'

type Point = readonly [number, number]
type Vertex3 = readonly [number, number, number]

const {tunnel} = lowerGallery
const halfWidth = tunnel.width / 2
/** Push a triangle with outward normal (b - a) × (c - a) into an unindexed position list. */
function pushTriangle(positions: Array<number>, a: Vertex3, b: Vertex3, c: Vertex3) {
  positions.push(...a, ...b, ...c)
}
/** Push a planar quad [a, b, c, d] (counter-clockwise as seen from its outward normal). */
function pushQuad(positions: Array<number>, a: Vertex3, b: Vertex3, c: Vertex3, d: Vertex3) {
  pushTriangle(positions, a, b, c)
  pushTriangle(positions, a, c, d)
}

/**
 * Watertight slab geometry for the Exhibition’s 3-segment beveled passage (level north entry and elbow, sloped diagonal gallery, level south elbow and exit), with plumb ends and constant vertical thickness.
 */
export class ExhibitionTunnelSlabGeometry extends BufferGeometry {
  constructor(topOffset: number, thickness: number) {
    super()
    if (!Number.isFinite(topOffset) || !(thickness > 0)) {
      throw new RangeError('An Exhibition tunnel slab needs a finite offset and positive thickness.')
    }
    const [w0, w1, w2, w3] = tunnelBoundary.west
    const [e0, e1, e2, e3] = tunnelBoundary.east
    const wSlopeStart = tunnelDiagonalPoint(tunnelSlopeStartS, -halfWidth)
    const eSlopeStart = tunnelDiagonalPoint(tunnelSlopeStartS, halfWidth)
    const wSlopeEnd = tunnelDiagonalPoint(tunnelSlopeEndS, -halfWidth)
    const eSlopeEnd = tunnelDiagonalPoint(tunnelSlopeEndS, halfWidth)
    const yNorth = tunnel.northY + topOffset
    const ySouth = tunnel.southY + topOffset
    const v = ([x, z]: Point, y: number): Vertex3 => [x, y, z]
    const positions: Array<number> = []
    const cap = (top: boolean) => {
      const shift = top ? 0 : -thickness
      const yn = yNorth + shift
      const ys = ySouth + shift
      const quad = (a: Vertex3, b: Vertex3, c: Vertex3, d: Vertex3) => {
        if (top) {
          pushQuad(positions, a, b, c, d)
        } else {
          pushQuad(positions, a, d, c, b)
        }
      }
      const tri = (a: Vertex3, b: Vertex3, c: Vertex3) => {
        if (top) {
          pushTriangle(positions, a, b, c)
        } else {
          pushTriangle(positions, a, c, b)
        }
      }
      quad(v(w0, yn), v(w1, yn), v(e1, yn), v(e0, yn))
      tri(v(w1, yn), v(eSlopeStart, yn), v(e1, yn))
      tri(v(w1, yn), v(wSlopeStart, yn), v(eSlopeStart, yn))
      quad(v(wSlopeStart, yn), v(wSlopeEnd, ys), v(eSlopeEnd, ys), v(eSlopeStart, yn))
      tri(v(wSlopeEnd, ys), v(w2, ys), v(eSlopeEnd, ys))
      tri(v(w2, ys), v(e2, ys), v(eSlopeEnd, ys))
      quad(v(w2, ys), v(w3, ys), v(e3, ys), v(e2, ys))
    }
    cap(true)
    cap(false)
    const westChain: ReadonlyArray<readonly [Point, number]> = [
      [w0, yNorth],
      [w1, yNorth],
      [wSlopeStart, yNorth],
      [wSlopeEnd, ySouth],
      [w2, ySouth],
      [w3, ySouth],
    ]
    const eastChain: ReadonlyArray<readonly [Point, number]> = [
      [e0, yNorth],
      [e1, yNorth],
      [eSlopeStart, yNorth],
      [eSlopeEnd, ySouth],
      [e2, ySouth],
      [e3, ySouth],
    ]
    for (let i = 0; i < westChain.length - 1; i++) {
      const [pa, ya] = westChain[i]
      const [pb, yb] = westChain[i + 1]
      pushQuad(positions, v(pa, ya), v(pa, ya - thickness), v(pb, yb - thickness), v(pb, yb))
    }
    for (let i = 0; i < eastChain.length - 1; i++) {
      const [pa, ya] = eastChain[i]
      const [pb, yb] = eastChain[i + 1]
      pushQuad(positions, v(pb, yb), v(pb, yb - thickness), v(pa, ya - thickness), v(pa, ya))
    }
    pushQuad(positions, v(e0, yNorth), v(e0, yNorth - thickness), v(w0, yNorth - thickness), v(w0, yNorth))
    pushQuad(positions, v(w3, ySouth), v(w3, ySouth - thickness), v(e3, ySouth - thickness), v(e3, ySouth))
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.computeVertexNormals()
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}

/**
 * Watertight level prism geometry over a convex polygon in world xz, from `bottom` to `top`.
 */
export class PolygonalSlabGeometry extends BufferGeometry {
  constructor(polygon: FloorPolygon, bottom: number, top: number) {
    super()
    if (polygon.length < 3 || !Number.isFinite(bottom) || !Number.isFinite(top) || !(top > bottom)) {
      throw new RangeError('A polygonal slab needs at least three corners and a positive height.')
    }
    // Ensure clockwise winding in (x, z) (negative signed area) so (p0 -> a -> b) has +y normal!
    let area2 = 0
    for (let i = 0; i < polygon.length; i++) {
      const [ax, az] = polygon[i]
      const [bx, bz] = polygon[(i + 1) % polygon.length]
      area2 += ax * bz - bx * az
    }
    const ring = area2 < 0 ? polygon : polygon.toReversed()
    const positions: Array<number> = []
    const [p0x, p0z] = ring[0]
    for (let i = 1; i < ring.length - 1; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[i + 1]
      pushTriangle(positions, [p0x, top, p0z], [ax, top, az], [bx, top, bz])
      pushTriangle(positions, [p0x, bottom, p0z], [bx, bottom, bz], [ax, bottom, az])
    }
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      pushQuad(positions, [ax, top, az], [ax, bottom, az], [bx, bottom, bz], [bx, top, bz])
    }
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.computeVertexNormals()
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}

/**
 * Fills the small vertical corner wedges at the Exhibition passage’s four beveled corners:
 * the inside-corner wall-face wedges behind the mitered trim (`w1`, `e2`) and the outside-corner baseboard/cornice miter wedges (`e1`, `w2`), with zero coplanar overlap.
 */
export class ExhibitionBevelCornerGeometry extends BufferGeometry {
  constructor() {
    super()
    const [, w1] = tunnelBoundary.west
    const [, , e2] = tunnelBoundary.east
    const positions: Array<number> = []
    const addPrism = (polygon: FloorPolygon, bottom: number, top: number) => {
      let area2 = 0
      for (let i = 0; i < polygon.length; i++) {
        const [ax, az] = polygon[i]
        const [bx, bz] = polygon[(i + 1) % polygon.length]
        area2 += ax * bz - bx * az
      }
      const ring = area2 < 0 ? polygon : polygon.toReversed()
      const [p0x, p0z] = ring[0]
      for (let i = 1; i < ring.length - 1; i++) {
        const [ax, az] = ring[i]
        const [bx, bz] = ring[i + 1]
        pushTriangle(positions, [p0x, top, p0z], [ax, top, az], [bx, top, bz])
        pushTriangle(positions, [p0x, bottom, p0z], [bx, bottom, bz], [ax, bottom, az])
      }
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i]
        const [bx, bz] = ring[(i + 1) % ring.length]
        pushQuad(positions, [ax, top, az], [ax, bottom, az], [bx, bottom, bz], [bx, top, bz])
      }
    }
    const [ex, ez] = tunnelDiagonalEast
    const addOutside = (corner: Point, floorY: number, nA: Point, nB: Point) => {
      const denom = 1 + nA[0] * nB[0] + nA[1] * nB[1]
      const ptAt = (n: Point, d: number): Point => [corner[0] + n[0] * d, corner[1] + n[1] * d]
      const bisectorAt = (d: number): Point => [
        corner[0] + (nA[0] + nB[0]) * d / denom,
        corner[1] + (nA[1] + nB[1]) * d / denom,
      ]
      const faceCross = bisectorAt(wallFace)
      addPrism([corner, ptAt(nA, wallFace), faceCross, ptAt(nB, wallFace)], floorY, floorY + tunnel.height)
      const band = (front: number, bottom: number, top: number) => {
        const outer = bisectorAt(front)
        addPrism([ptAt(nA, wallFace), ptAt(nA, front), outer, faceCross], floorY + bottom, floorY + top)
        addPrism([faceCross, outer, ptAt(nB, front), ptAt(nB, wallFace)], floorY + bottom, floorY + top)
      }
      band(baseboardBandFront, 0, defaultBaseboardHeight - baseboardCapHeight)
      band(baseboardCapFront, defaultBaseboardHeight - baseboardCapHeight, defaultBaseboardHeight)
      for (const {height, front, drop} of corniceBands) {
        band(front, tunnel.height - drop - height / 2, tunnel.height - drop + height / 2)
      }
    }
    // Outside corners (> 180° inside the tunnel): w1 (north-west) and e2 (south-east).
    // Inside corners (e1 and w2) are already mitered cleanly by cornerMiters.
    addOutside(w1, tunnel.northY, [1, 0], [ex, ez])
    addOutside(e2, tunnel.southY, [-ex, -ez], [-1, 0])
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.computeVertexNormals()
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}

export {tunnelDiagonalFloorY} from './lowerGallery.ts'
