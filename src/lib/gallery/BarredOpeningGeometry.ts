import type {Wall, WallOpening} from '../placement/wallGeometry.ts'

import {BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, ShapeUtils, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {openingArc, openingTop} from '../placement/wallGeometry.ts'
import {barDepth} from './architectureDimensions.ts'
import {bendGeometry, curveSegments, sliceAlongX} from './CurvedBoxGeometry.ts'
import openingOutline from './openingOutline.ts'

export type BarredOpeningOptions = {
  /** where the opening comes out at the back of the gap, in the wall’s own coordinates: wider than the opening, it splays through the gap like an embrasure; the opening itself if left out */
  back?: WallOpening
  /** the heights of the flat iron bands across the bars, over the wall’s foot */
  bands: ReadonlyArray<number>
  /** how far behind the wall’s center line the opening runs on, through the gap to the wall it meets there */
  depth: number
  /** a low mouse hole through the bars, in the wall’s own coordinates */
  hatch?: WallOpening
}
type Point = readonly [x: number, y: number, z: number]
type Triangle = readonly [Point, Point, Point]

/** how far apart the bars stand, at most, along the wall’s center line */
const barSpacing = 0.15
const barRadius = 0.016
const bandHeight = 0.05
const bandThickness = 0.014
/** how deep the iron reaches into the stone around the opening */
const embed = 0.06
/** how far the reveal’s stone reaches past the opening, into the walls on both sides of the gap */
const margin = 0.25
/** where the points lie on average */
const centroid = (points: ReadonlyArray<Vector2>) => points.reduce((sum, point) => sum.add(point), new Vector2).multiplyScalar(1 / points.length)

/**
 * The iron in an opening through a wall, in the wall’s own frame and unbent: upright bars evenly spaced across it, at most {@link barSpacing} apart, reaching into the stone round it at both ends, and flat bands across them at the `bands` heights over the wall’s foot, all {@link barDepth} in front of the wall’s center line.
 * A `hatch` leaves a low opening through the bars at their foot, framed by a flat strap bent round it: the bars over it stand on the strap, and bands lower than its head stop at it on both sides.
 */
export function barredIron(hole: WallOpening, bands: ReadonlyArray<number>, {curveRadius, hatch}: {
  /** the wall’s, along which the bands bend */
  curveRadius?: number
  /** the low opening through the bars, in the wall’s coordinates like the opening, from its foot */
  hatch?: WallOpening
} = {}) {
  const bottom = hole.bottom ?? 0
  const halfWidth = hole.width / 2
  const parts: Array<BufferGeometry> = []
  /** how far out from the hatch’s middle the strap round it reaches at the height, or 0 above it */
  const strapReach = (y: number) => {
    if (!hatch || y >= openingTop(hatch, hatch.u, bandHeight)) {
      return 0
    }
    const {radius, center} = openingArc(hatch)
    const jamb = hatch.width / 2 + bandHeight
    const head = Math.sqrt(Math.max(0, (radius + bandHeight) ** 2 - (y - center) ** 2))
    return y <= center ? jamb : Math.min(jamb, head)
  }
  const count = Math.ceil(hole.width / barSpacing) - 1
  for (let i = 0; i < count; i++) {
    const u = hole.u - halfWidth + hole.width * (i + 1) / (count + 1)
    // Over the hatch, a bar stands on the middle of its strap.
    const foot = Math.max(bottom - embed, hatch ? openingTop(hatch, u, bandHeight / 2) : -Infinity)
    const head = openingTop(hole, u) + embed
    const bar = new CylinderGeometry(barRadius, barRadius, head - foot, 6, 1, true)
    parts.push(bar.translate(u, (foot + head) / 2, barDepth))
  }
  /** a flat band from `from` to `to` along the wall at the height */
  const band = (from: number, to: number, y: number) => {
    const length = to - from
    const geometry = new BoxGeometry(length, bandHeight, bandThickness, curveRadius ? Math.max(2, Math.ceil(Math.abs(length / curveRadius) * 16)) : 1)
    return geometry.translate((from + to) / 2, y, barDepth)
  }
  for (const y of bands) {
    const from = hole.u - halfWidth - embed
    const to = hole.u + halfWidth + embed
    const reach = strapReach(y)
    if (!hatch || !reach) {
      parts.push(band(from, to, y))
      continue
    }
    parts.push(band(from, hatch.u - reach, y), band(hatch.u + reach, to, y))
  }
  if (hatch) {
    const {radius, center} = openingArc(hatch)
    const middle = radius + bandHeight / 2
    const jamb = hatch.width / 2 + bandHeight / 2
    // Up both jambs from inside the floor to where the head springs, then over the head in chords.
    const spring = center + Math.sqrt(Math.max(0, middle ** 2 - jamb ** 2))
    const foot = (hatch.bottom ?? 0) - embed
    for (const side of [-1, 1]) {
      const strap = new BoxGeometry(bandHeight, spring - foot, bandThickness)
      parts.push(strap.translate(hatch.u + side * jamb, (foot + spring) / 2, barDepth))
    }
    const start = Math.atan2(Math.sqrt(Math.max(0, middle ** 2 - jamb ** 2)), jamb)
    const chords = 10
    const sweep = (Math.PI - start * 2) / chords
    for (let chord = 0; chord < chords; chord++) {
      const angle = start + sweep * (chord + 0.5)
      // A little longer than the chord, so neighbors meet on the outside of the bend.
      const length = 2 * middle * Math.sin(sweep / 2) + bandHeight * Math.tan(sweep / 2)
      const piece = new BoxGeometry(length, bandHeight, bandThickness)
      piece.rotateZ(angle - Math.PI / 2)
      parts.push(piece.translate(hatch.u + Math.cos(angle) * middle, center + Math.sin(angle) * middle, barDepth))
    }
  }
  return parts
}

/**
 * The stone reveal that lines an opening through a wall on through the gap behind it to the wall it meets there, from the wall’s center line `depth` meters back, where the other wall’s center line lies, there as wide as the `back` opening; for an opening down to the floor, its sill fills the gap between both floors.
 * Built in the wall’s own frame, bent with it if it curves, and placed with it in world space.
 */
export function openingReveal(wall: Pick<Wall, 'center' | 'curveRadius' | 'rotation' | 'width'>, hole: WallOpening, depth: number, back = hole) {
  const bottom = hole.bottom ?? 0
  const halfWidth = hole.width / 2
  const front = openingOutline(hole)
  const rear = openingOutline(back)
  if (hole.profile !== back.profile) {
    throw new RangeError('An opening and the back it splays out to need the same profile.')
  }
  const left = Math.min(hole.u - halfWidth, back.u - back.width / 2) - margin
  const right = Math.max(hole.u + halfWidth, back.u + back.width / 2) + margin
  const low = Math.min(bottom, back.bottom ?? 0) - margin
  const high = Math.max(openingTop(hole, hole.u), openingTop(back, back.u)) + margin
  const frame = [new Vector2(left, low), new Vector2(right, low), new Vector2(right, high), new Vector2(left, high)]
  const solid = new FacetedSolid
  // Its faces at the wall’s center line and at the back, the frame round the opening and round its back
  for (const [z, opening] of [[0, front], [-depth, rear]] as const) {
    const corners = [...frame, ...opening]
    solid.add(ShapeUtils.triangulateShape(frame, [opening]).map(([a, b, c]): Triangle => [a, b, c].map(index => [corners[index].x, corners[index].y, z] as const) as unknown as Triangle), new Vector3(0, 0, z ? -1 : 1))
  }
  // The frame’s sides facing away from its middle, and the opening’s, lofted from its outline on the wall to its back, facing into it
  const sides = [
    [frame.map(corner => [corner, corner] as const), centroid(frame), -1],
    [front.map((corner, i) => [corner, rear[i]] as const), centroid(front), 1],
  ] as const
  for (const [ring, middle, facing] of sides) {
    for (const [i, [nearA, farA]] of ring.entries()) {
      const [nearB, farB] = ring[(i + 1) % ring.length]
      const quad: Array<Point> = [[nearA.x, nearA.y, 0], [nearB.x, nearB.y, 0], [farB.x, farB.y, -depth], [farA.x, farA.y, -depth]]
      const toMiddle = middle.clone().sub(nearA.clone().add(nearB).multiplyScalar(0.5)).multiplyScalar(facing)
      solid.add([[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]], new Vector3(toMiddle.x, toMiddle.y, 0))
    }
  }
  const reveal = solid.geometry()
  if (wall.curveRadius) {
    sliceAlongX(reveal, wall.width / curveSegments(wall.width, wall.curveRadius), -wall.width / 2)
    bendGeometry(reveal, wall.curveRadius)
  }
  const place = new Matrix4
  place.makeRotationY(wall.rotation).setPosition(...wall.center)
  return mergeParts([reveal.applyMatrix4(place)])
}

/**
 * The iron bars in an opening through a wall, and the stone reveal that lines the opening on through the gap behind the wall to the wall it meets there, like the apse’s gate and windows through the Oculus’ wall and the Bastion’s behind it, see {@link openingReveal}.
 * Both are built in the wall’s own frame, bent with it if it curves, and placed with it in world space.
 * The bars stand in the wall itself, where the opening is no wider than on its face, splayed or not.
 */
export default class BarredOpeningGeometry {
  readonly bars: BufferGeometry
  readonly reveal: BufferGeometry

  constructor(wall: Pick<Wall, 'center' | 'curveRadius' | 'rotation' | 'width'>, hole: WallOpening, {bands, depth, back = hole, hatch}: BarredOpeningOptions) {
    this.reveal = openingReveal(wall, hole, depth, back)
    const iron = barredIron(hole, bands, {
      curveRadius: wall.curveRadius,
      hatch,
    })
    const place = new Matrix4
    place.makeRotationY(wall.rotation).setPosition(...wall.center)
    for (const part of iron) {
      if (wall.curveRadius) {
        bendGeometry(part, wall.curveRadius)
      }
      part.applyMatrix4(place)
    }
    this.bars = mergeParts(iron)
  }

  dispose() {
    this.reveal.dispose()
    this.bars.dispose()
  }
}

/** A solid of flat-shaded triangles, each wound so that it faces out of the solid. */
class FacetedSolid {
  readonly normals: Array<number> = []
  readonly positions: Array<number> = []

  /** Adds triangles, wound to face the side `outward` points to. */
  add(triangles: ReadonlyArray<Triangle>, outward: Vector3) {
    for (const corners of triangles) {
      const [a, b, c] = corners.map(corner => new Vector3(...corner))
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
      const facing = normal.dot(outward) < 0 ? [a, c, b] : [a, b, c]
      if (normal.dot(outward) < 0) {
        normal.negate()
      }
      for (const corner of facing) {
        this.positions.push(corner.x, corner.y, corner.z)
        this.normals.push(normal.x, normal.y, normal.z)
      }
    }
  }

  geometry() {
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    return geometry
  }
}
