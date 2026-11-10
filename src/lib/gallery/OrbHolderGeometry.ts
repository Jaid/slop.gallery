import type {BufferGeometry} from 'three/webgpu'

import {ParametricGeometry} from 'three/addons/geometries/ParametricGeometry.js'
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'
import {ExtrudeGeometry, LatheGeometry, Shape, SphereGeometry, TorusGeometry, Vector2} from 'three/webgpu'

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
const segments = 96

/** how high the middle of an orb resting on the lip stands over the holder’s foot, where its ball touches the lip’s roll all round */
export const orbSeat = lip.y + Math.sqrt((orbRadius + lip.tube) ** 2 - lip.radius ** 2)

const semicircle = ([radius, y]: Point, size: number, from: number, to: number, steps = 8): Array<Vector2> => Array.from({length: steps + 1}, (_, index) => {
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
  const wall = new ParametricGeometry((u, v, target) => {
    const angle = u * Math.PI * 2
    // 1 in the middle of a lobe, falling sharply into the crease between two.
    const lobe = Math.abs(Math.cos(angle * cup.lobes / 2)) ** 0.5
    const radius = cupRadius(v) * (1 - cup.crease * Math.sin(Math.PI * v) ** 0.6 * (1 - lobe))
    // Turning the same way as a lathe, so the wall faces out.
    target.set(Math.sin(angle) * radius, cupY(v), Math.cos(angle) * radius)
  }, cup.lobes * 12, 16)
  // Smoothed in centimeters, as the normal utility welds positions closer than 0.01 units; the creases stay sharp.
  const smooth = toCreasedNormals(wall.scale(100, 100, 100), Math.PI / 5).scale(0.01, 0.01, 0.01)
  wall.dispose()
  return smooth
}
/** An acanthus leaf’s outline, `width` across its foot and `height` up to its tip, its edges lobed three times on either side. */
function leafShape(width: number, height: number) {
  const half = width / 2
  // Up the right edge from the foot to the tip as curves bulging out between their ends, three lobes, each narrower and higher than the one below.
  const right: Array<{
    control: readonly [number, number]
    end: readonly [number, number]
  }> = []
  let start: Point = [half * 0.55, 0]
  for (const [reach, rise] of [[1, 0.3], [0.78, 0.58], [0.48, 0.82]] as const) {
    const end = [half * reach * 0.55, height * rise] as const
    right.push({
      control: [half * reach * 1.15, (start[1] + end[1]) / 2],
      end,
    })
    start = end
  }
  right.push({
    control: [half * 0.2, height * 0.95],
    end: [0, height],
  })
  const shape = new Shape
  shape.moveTo(-half * 0.55, 0)
  shape.lineTo(half * 0.55, 0)
  for (const {control, end} of right) {
    shape.quadraticCurveTo(...control, ...end)
  }
  // Down the left edge, the right one mirrored: each curve back to where its mirror image started.
  for (const [index, {control}] of right.entries().toArray().toReversed()) {
    const [x, y] = index ? right[index - 1].end : [half * 0.55, 0]
    shape.quadraticCurveTo(-control[0], control[1], -x, y)
  }
  return shape
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
    bevelSegments: 3,
    bevelSize: feet.bevel,
    bevelThickness: feet.bevel,
    bevelOffset: -feet.bevel,
    curveSegments: 10,
  })
  const toe = new SphereGeometry(0.011, 16, 10)
  const parts: Array<BufferGeometry> = [
    bracket.translate(0, 0, -feet.depth / 2),
    toe.scale(1.2, 0.8, 1.1).translate(0.143, 0.0088, 0),
  ]
  // Its back on the frieze, its face standing just out of the beads.
  const leaf = new ExtrudeGeometry(leafShape(0.028, 0.03), {
    depth: 0.006,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.0012,
    bevelThickness: 0.0015,
    curveSegments: 6,
  })
  parts.push(leaf.rotateY(Math.PI / 2).translate(band.frieze + 0.0015, band.bottom - 0.002, 0))
  return parts
}

/**
 * A stand for an orb on a pedestal’s cap, cast in dark metal like a fortune teller’s crystal ball stand, the y axis up through its middle from the cap.
 *
 * A gadrooned cup with a rolled lip, which the orb rests in, stands on a band beaded along both edges, raised on three scrolled feet with acanthus leaves, one of them to the front.
 */
export default class OrbHolderGeometry {
  /** the stand turned smooth, without its lobes, feet and ornament, where the orb and everything thrown at it touch it */
  readonly collision: LatheGeometry
  readonly metal: BufferGeometry

  constructor() {
    const lipRoll = new TorusGeometry(lip.radius, lip.tube, 12, segments)
    const inside = new LatheGeometry(bowl.map(([radius, y]) => new Vector2(radius, y)), segments)
    const parts: Array<BufferGeometry> = [
      new LatheGeometry(bandProfile(), segments),
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
