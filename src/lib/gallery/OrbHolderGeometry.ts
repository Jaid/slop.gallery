import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'
import {BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Shape, SphereGeometry, TorusGeometry, Vector2} from 'three/webgpu'

import {orbRadius} from '#src/orbs/index.ts'

import {mergeParts} from '../geometry.ts'

/** a point in a plane: of a turned outline, its radius and height, or of a flat one, across and up */
type Point = readonly [x: number, y: number]

/** the beaded band the cup stands on, raised over the cap on the feet: its underside, the beads along its bottom and top edges and the plain frieze between them */
const band = {
  bottom: 0.034,
  beadRadius: 0.005,
  beadCenter: 0.114,
  frieze: 0.112,
  top: 0.064,
}
/** the gadrooned cup on the band, from its foot up to under the lip, bulging out between */
const cup = {
  foot: [0.094, 0.068],
  top: [0.112, 0.119],
  bulge: 0.016,
  lobes: 16,
  /** how deep the creases between the lobes cut in, as a share of the cup’s radius where they are deepest */
  crease: 0.075,
} as const
/** the rolled lip round the cup’s mouth, which the orb rests on */
const lip = {
  radius: 0.108,
  tube: 0.0075,
  y: 0.124,
}
/** the scrolled feet under the band, evenly round it, one of them pointing to the front, along +z */
const feet = {
  count: 3,
  /** how thick a foot’s bracket is across, apart from its rounded edges */
  depth: 0.014,
  bevel: 0.003,
}
// Circular edges deviate by at most 0.26 mm; finer sampling is reserved for the cup’s creases.
const segments = 48

/** how high the middle of an orb resting on the lip stands over the holder’s foot, where its ball touches the lip’s roll all round */
export const orbSeat = lip.y + Math.sqrt((orbRadius + lip.tube) ** 2 - lip.radius ** 2)

const semicircle = ([radius, y]: Point, size: number, from: number, to: number, steps = 3): Array<Vector2> => Array.from({length: steps + 1}, (_, index) => {
  const angle = from + (to - from) * index / steps
  return new Vector2(radius + Math.cos(angle) * size, y + Math.sin(angle) * size)
})
/** the cup’s outline before it is gadrooned, `t` from its foot up to under the lip: swelling out below its middle and drawing in again toward the lip */
const cupRadius = (t: number) => cup.foot[0] + (cup.top[0] - cup.foot[0]) * t + cup.bulge * Math.sin(Math.PI * t ** 0.75)
const cupY = (t: number) => cup.foot[1] + (cup.top[1] - cup.foot[1]) * t
/** where the orb’s ball meets nothing but the lip: the hollow inside the cup, from under the lip down to the middle */
const bowl: Array<Point> = [
  [lip.radius - lip.tube, lip.y],
  [0.098, 0.112],
  [0.085, 0.095],
  [0.06, 0.08],
  [0.03, 0.074],
  [0, 0.073],
]
/** The band’s turned outline, from the middle of its underside out and up round its beads to the cup’s foot. */
function bandProfile() {
  return [
    new Vector2(0, band.bottom),
    new Vector2(band.beadCenter, band.bottom),
    ...semicircle([band.beadCenter, band.bottom + band.beadRadius], band.beadRadius, -Math.PI / 2, Math.PI / 2).slice(1),
    new Vector2(band.frieze, band.bottom + band.beadRadius * 2),
    new Vector2(band.frieze, band.top - band.beadRadius * 2),
    ...semicircle([band.beadCenter, band.top - band.beadRadius], band.beadRadius, -Math.PI / 2, Math.PI / 2),
    new Vector2(0.1, band.top),
    new Vector2(cup.foot[0], cup.foot[1]),
  ]
}
/** The cup’s outer wall, gadrooned into lobes that swell out between sharp creases, smooth again at its foot and under the lip. */
function cupWall() {
  // Each lobe owns its crease vertices, so normals stay smooth up the cup but never bridge a valley.
  // Six spans across a lobe retain its rounded highlight; the five vertical spans follow the silhouette’s curvature.
  const across = 6
  const levels = [0, 0.12, 0.32, 0.6, 0.84, 1]
  const parts: Array<BufferGeometry> = []
  for (let lobe = 0; lobe < cup.lobes; lobe++) {
    const positions: Array<number> = []
    const uvs: Array<number> = []
    const indices: Array<number> = []
    for (const [row, v] of levels.entries()) {
      for (let column = 0; column <= across; column++) {
        const u = (lobe + column / across + 0.5) / cup.lobes
        const angle = u * Math.PI * 2
        const roundness = Math.max(0, Math.sin(column / across * Math.PI)) ** 0.5
        const radius = cupRadius(v) * (1 - cup.crease * Math.sin(Math.PI * v) ** 0.6 * (1 - roundness))
        // Tuck the foot 0.5 mm into the band, closing the seam between its 48 sides and the cup’s 96.
        positions.push(Math.sin(angle) * radius, cupY(v) - (row === 0 ? 0.0005 : 0), Math.cos(angle) * radius)
        uvs.push(u, v)
        if (!row || !column) {
          continue
        }
        const d = row * (across + 1) + column
        const c = d - 1
        const b = d - across - 1
        const a = b - 1
        indices.push(a, b, c, b, d, c)
      }
    }
    const part = new BufferGeometry
    part.setAttribute('position', new Float32BufferAttribute(positions, 3))
    part.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    part.setIndex(indices)
    part.computeVertexNormals()
    parts.push(part)
  }
  return mergeParts(parts)
}
/** A small cast leaf with three pairs of lobes and a raised midrib, closed behind rather than a densely beveled extrusion. */
function leaf() {
  const levels = [[0, 0.0077], [0.0045, 0.012], [0.009, 0.0065], [0.013, 0.009], [0.0174, 0.0045], [0.021, 0.006], [0.0246, 0.0025]] as const
  const positions: Array<number> = []
  const uvs: Array<number> = []
  const indices: Array<number> = []
  for (const [row, [y, half]] of levels.entries()) {
    // Across the relief’s face, then back down its shallow reverse; all coordinates are local meters.
    for (const [x, z] of [[-half, 0], [0, 0.007], [half, 0], [0, -0.002]]) {
      positions.push(x, y, z)
      uvs.push(x / 0.028 + 0.5, y / 0.03)
    }
    if (row) {
      for (let side = 0; side < 4; side++) {
        const a = (row - 1) * 4 + side
        const b = (row - 1) * 4 + (side + 1) % 4
        const c = row * 4 + side
        const d = row * 4 + (side + 1) % 4
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  indices.push(0, 3, 1, 1, 3, 2)
  const tip = positions.length / 3
  positions.push(0, 0.03, 0)
  uvs.push(0.5, 1)
  for (let side = 0; side < 4; side++) {
    const last = (levels.length - 1) * 4
    indices.push(last + side, last + (side + 1) % 4, tip)
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
/** Smooth curved extrusions in centimeters, keeping the broad side faces flat. */
function smoothFoot(geometry: BufferGeometry) {
  // Stay below the 45° chamfer angle with margin, so rounding never blends into the broad side faces.
  const smooth = toCreasedNormals(geometry.scale(100, 100, 100), Math.PI * 2 / 9).scale(0.01, 0.01, 0.01)
  // Nonindexed extrusions are smoothed in place; only dispose a separate temporary.
  if (smooth !== geometry) {
    geometry.dispose()
  }
  return smooth
}
/** LatheGeometry emits a collapsed triangle per segment at each pole; omit those instead of spending the budget on invisible faces. */
function turned(profile: Array<Vector2>, resolution = segments) {
  const geometry = new LatheGeometry(profile, resolution)
  const indices = geometry.index!
  const valid: Array<number> = []
  for (let segment = 0; segment < resolution; segment++) {
    for (let row = 0; row < profile.length - 1; row++) {
      const offset = (segment * (profile.length - 1) + row) * 6
      if (profile[row].x !== 0) {
        valid.push(indices.getX(offset), indices.getX(offset + 1), indices.getX(offset + 2))
      }
      if (profile[row + 1].x !== 0) {
        valid.push(indices.getX(offset + 3), indices.getX(offset + 4), indices.getX(offset + 5))
      }
    }
  }
  geometry.setIndex(valid)
  return geometry
}
/** One scrolled foot, standing out along x: a bracket bending out from under the band to a round toe, and an acanthus leaf rising over the band. */
function foot(): Array<BufferGeometry> {
  const outline = new Shape
  outline.moveTo(0.09, 0.042)
  outline.lineTo(0.117, 0.042)
  outline.bezierCurveTo(0.13, 0.04, 0.138, 0.03, 0.138, 0.02)
  outline.bezierCurveTo(0.138, 0.012, 0.142, 0.006, 0.15, 0.003)
  outline.lineTo(0.15, 0)
  outline.lineTo(0.12, 0)
  outline.bezierCurveTo(0.112, 0.004, 0.104, 0.016, 0.098, 0.026)
  outline.bezierCurveTo(0.094, 0.032, 0.09, 0.036, 0.09, 0.042)
  const bracket = new ExtrudeGeometry(outline, {
    depth: feet.depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: feet.bevel,
    bevelThickness: feet.bevel,
    bevelOffset: -feet.bevel,
    curveSegments: 3,
  })
  const toe = new SphereGeometry(0.011, 8, 5)
  const parts: Array<BufferGeometry> = [
    smoothFoot(bracket).translate(0, 0, -feet.depth / 2),
    toe.scale(1.2, 0.8, 1.1).translate(0.143, 0.0088, 0),
  ]
  // Its back on the frieze, its face standing just out of the beads.
  parts.push(leaf().rotateY(Math.PI / 2).translate(band.frieze + 0.0015, band.bottom - 0.002, 0))
  return parts
}

/**
 * A stand for an orb on a pedestal’s cap, cast in dark metal like a fortune teller’s crystal ball stand, the y axis up through its middle from the cap.
 *
 * A gadrooned cup with a rolled lip, which the orb rests in, stands on a band beaded along both edges, raised on three scrolled feet with acanthus leaves, one of them to the front.
 * The complete visible holder uses 3960 triangles; its independent collision surface preserves the orb’s seat and stability.
 */
export default class OrbHolderGeometry {
  /** the stand turned smooth, without its lobes, feet and ornament, where the orb and everything thrown at it touch it */
  readonly collision: LatheGeometry
  readonly metal: BufferGeometry

  constructor() {
    const lipRoll = new TorusGeometry(lip.radius, lip.tube, 8, segments)
    const inside = turned(bowl.map(([radius, y]) => new Vector2(radius, y)))
    const parts: Array<BufferGeometry> = [
      turned(bandProfile()),
      cupWall(),
      lipRoll.rotateX(Math.PI / 2).translate(0, lip.y, 0),
      // From the lip down to the middle, so the bowl faces up and in.
      inside,
    ]
    for (let index = 0; index < feet.count; index++) {
      // A foot stands out along x until it is turned toward the front, then on round by a third each.
      parts.push(...foot().map(part => part.rotateY(-Math.PI / 2 + index * Math.PI * 2 / feet.count)))
    }
    this.metal = mergeParts(parts)
    const outline = [
      new Vector2(0, 0),
      new Vector2(0.125, 0),
      new Vector2(0.12, band.top),
      ...Array.from({length: 9}, (_, index) => new Vector2(cupRadius(index / 8), cupY(index / 8))),
      ...semicircle([lip.radius, lip.y], lip.tube, -Math.PI / 4, Math.PI, 12),
      ...bowl.slice(1).map(([radius, y]) => new Vector2(radius, y)),
    ]
    this.collision = new LatheGeometry(outline, 48)
  }

  dispose() {
    this.metal.dispose()
    this.collision.dispose()
  }
}
