import type {BufferGeometry} from 'three/webgpu'

import {BufferGeometry as BareGeometry, Float32BufferAttribute, LatheGeometry, SphereGeometry, TorusGeometry, Uint32BufferAttribute, Vector2, Vector3} from 'three/webgpu'

import {orbRadius} from '#src/orbs/index.ts'

import {mergeParts} from '../geometry.ts'
import LobedProfileGeometry from './LobedProfileGeometry.ts'
import RevolvedProfileGeometry from './RevolvedProfileGeometry.ts'

/** a point of a turned outline: its radius and its height */
type Point = readonly [number, number]

/** the beaded band the cup stands on, raised over the cap on the feet: its underside, the beads along its bottom and top edges and the plain frieze between them */
const band = {
  bottom: 0.034,
  beadRadius: 0.005,
  beadCenter: 0.114,
  frieze: 0.107,
  top: 0.064,
}
/** the gadrooned cup on the band, from its foot up to under the lip, bulging out between */
const cup = {
  foot: [0.094, 0.068] satisfies Point,
  top: [0.108, 0.119] satisfies Point,
  lobes: 12,
  /** how far a lobe swells past the cup’s mean radius where the gadrooning is strongest */
  swell: 0.009,
}
/** the rolled lip round the cup’s mouth, which the orb rests on */
const lip = {
  radius: 0.108,
  tube: 0.0075,
  y: 0.124,
}
/** the scrolled feet under the band, evenly round it, one of them pointing to the front, along +z */
const feet = {
  count: 3,
  /** how thick a foot’s bracket is across */
  depth: 0.016,
  /** how thick a foot’s bracket is through, edge to edge */
  thickness: 0.013,
}
/** sides of everything turned, enough for the beads to read round and shared with the lip so their rings line up */
const sides = 40

/** how high the middle of an orb resting on the lip stands over the holder’s foot, where its ball touches the lip’s roll all round */
export const orbSeat = lip.y + Math.sqrt((orbRadius + lip.tube) ** 2 - lip.radius ** 2)

/** points round a quarter or half circle round `[radius, y]`, from angle `from` to `to` */
const arc = ([radius, y]: Point, size: number, from: number, to: number, steps: number): Array<Point> => Array.from({length: steps + 1}, (_, index) => {
  const angle = from + (to - from) * index / steps
  return [radius + Math.cos(angle) * size, y + Math.sin(angle) * size] as const
})
/** The band’s turned outline, from the middle of its underside out and up round its beads to the cup’s foot. */
function bandProfile(): Array<Point> {
  return [
    [0, band.bottom],
    [band.beadCenter - band.beadRadius, band.bottom],
    ...arc([band.beadCenter, band.bottom + band.beadRadius], band.beadRadius, -Math.PI / 2, Math.PI / 2, 4).slice(1),
    [band.frieze, band.bottom + band.beadRadius * 2],
    [band.frieze, band.top - band.beadRadius * 2],
    ...arc([band.beadCenter, band.top - band.beadRadius], band.beadRadius, -Math.PI / 2, Math.PI / 2, 4),
    [0.1, band.top],
    cup.foot,
  ]
}
/** where the orb’s ball meets nothing but the lip: the hollow inside the cup, from its middle up to under the lip */
const bowl: Array<Point> = [
  [0, 0.078],
  [0.045, 0.082],
  [0.078, 0.096],
  [0.096, 0.112],
  [lip.radius - lip.tube, lip.y],
]
/** a bar’s section at one point of its curve: how far it reaches across z and through, edge to edge */
type BarSection = readonly [depth: number, thickness: number]
/** The cup’s outer wall, facing out: the lobed sweep runs up the profile, which leaves it facing in. */
function cupWall() {
  const wall = new LobedProfileGeometry(cupProfile(), {
    lobes: cup.lobes,
    segmentsPerLobe: 3,
    phase: Math.PI / cup.lobes,
  })
  const index = wall.index!
  for (let corner = 0; corner < index.count; corner += 3) {
    const swap = index.getX(corner + 1)
    index.setX(corner + 1, index.getX(corner + 2))
    index.setX(corner + 2, swap)
  }
  wall.computeVertexNormals()
  return wall
}
function cupProfile() {
  const rows = [
    [0.094, 0.068, 0],
    [0.1, 0.076, 0.3],
    [0.107, 0.085, 0.72],
    [0.112, 0.095, 1],
    [0.113, 0.104, 0.85],
    [0.111, 0.112, 0.4],
    [0.108, 0.119, 0],
  ] as const
  return rows.map(([radius, y, lobe]) => [radius, y, cup.swell * lobe, 0] as const)
}
/** a rounded rectangle’s corners, from the outside round to the inside: the flat faces take most of it, the rounded edges the rest */
function barSection(depth: number, thickness: number) {
  const halfDepth = depth / 2
  const halfThick = thickness / 2
  return [
    [halfThick, halfDepth],
    [halfThick, -halfDepth],
    [-halfThick * 0.55, -halfDepth],
    [-halfThick, -halfDepth * 0.55],
    [-halfThick, halfDepth * 0.55],
    [-halfThick * 0.55, halfDepth],
  ] as const
}
/**
 * A rounded bar bent along a curve in the xy plane, standing out along x.
 *
 * `spine` runs from its root to its end, each point with its own section, so the bar can taper. The section is a rounded rectangle and the bar faces out along the curve.
 */
function sweptBar(spine: ReadonlyArray<readonly [number, number, BarSection]>, around: number): BufferGeometry {
  const positions: Array<number> = []
  const normals: Array<number> = []
  const uvs: Array<number> = []
  const frames = spine.map(([x, y], index) => {
    const before = spine[Math.max(0, index - 1)]
    const after = spine[Math.min(spine.length - 1, index + 1)]
    const along = new Vector3(after[0] - before[0], after[1] - before[1], 0)
    along.normalize()
    // Out of the curve, in the xy plane, pointing to its right.
    const out = new Vector3(along.y, -along.x, 0)
    const side = new Vector3(0, 0, 1)
    return {
      out,
      side,
      along,
      at: new Vector3(x, y, 0),
    }
  })
  for (const [index, {out, side, at}] of frames.entries()) {
    const [, , [depth, thickness]] = spine[index]
    const section = barSection(depth, thickness)
    for (const [corner, [across, aside]] of section.entries()) {
      const normal = out.clone().multiplyScalar(across).addScaledVector(side, aside).normalize()
      const point = at.clone().addScaledVector(out, across).addScaledVector(side, aside)
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      uvs.push(corner / section.length, index / (spine.length - 1))
    }
  }
  const indices: Array<number> = []
  const corners = barSection(1, 1).length
  for (let index = 0; index < spine.length - 1; index++) {
    for (let corner = 0; corner < corners; corner++) {
      const next = (corner + 1) % corners
      const a = index * corners + corner
      const b = index * corners + next
      const c = (index + 1) * corners + next
      const d = (index + 1) * corners + corner
      indices.push(a, d, c, a, c, b)
    }
  }
  // Both ends close, so the bracket reads solid where it meets the band and at the toe.
  const cap = (frame: number, inward: boolean) => {
    const center = positions.length / 3
    const {along, at} = frames[frame]
    const normal = along.clone().multiplyScalar(inward ? -1 : 1)
    positions.push(at.x, at.y, at.z)
    normals.push(normal.x, normal.y, normal.z)
    uvs.push(0.5, frame === 0 ? 0 : 1)
    for (let corner = 0; corner < corners; corner++) {
      const next = (corner + 1) % corners
      const [a, b] = inward ? [frame * corners + next, frame * corners + corner] : [frame * corners + corner, frame * corners + next]
      indices.push(center, a, b)
    }
  }
  cap(0, true)
  cap(spine.length - 1, false)
  const geometry = new BareGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(new Uint32BufferAttribute(indices, 1))
  geometry.rotateY(around)
  return geometry
}
/**
 * A foot’s bracket, from under the band out and down onto a round toe.
 *
 * A quarter of an ellipse, never doubling back, so the bar cannot twist inside out. Thick where it leaves the band and thinning down to the toe, which swells round so it reads as a ball.
 */
function bracketSpine(): Array<readonly [number, number, BarSection]> {
  const points: Array<readonly [number, number, BarSection]> = []
  const steps = 8
  for (let index = 0; index <= steps; index++) {
    const t = index / steps
    const reach = 0.104 + 0.03 * Math.sin(t * Math.PI / 2)
    const y = 0.00935 + 0.037 * Math.cos(t * Math.PI / 2)
    // Thinning down the leg, then swelling again over the last of it into the toe.
    const taper = 1 - Math.sin(t * Math.PI) * 0.34
    points.push([reach, y, [feet.depth * taper, feet.thickness * taper]])
  }
  return points
}
/**
 * A stand for an orb on a pedestal’s cap, cast in dark metal like a fortune teller’s crystal ball stand, the y axis up through its middle from the cap.
 *
 * A gadrooned cup with a rolled lip, which the orb rests in, stands on a band beaded along both edges, raised on three scrolled feet, one of them to the front.
 */
export default class OrbHolderGeometry {
  /** the stand turned smooth, without its lobes, feet and ornament, where the orb and everything thrown at it touch it */
  readonly collision: BufferGeometry
  readonly metal: BufferGeometry

  constructor() {
    const lipRoll = new TorusGeometry(lip.radius, lip.tube, 6, sides)
    const parts: Array<BufferGeometry> = [
      // The frieze rises straight up, which leaves the sweep unable to tell its outside from its inside.
      new RevolvedProfileGeometry(bandProfile(), {
        sides,
        smoothAngle: Math.PI,
        front: () => [1, 0],
      }),
      // The profile sweeps upward, so the lobed wall faces in; the cup is seen from outside.
      cupWall(),
      lipRoll.rotateX(Math.PI / 2),
      lipRoll.translate(0, lip.y, 0),
      new RevolvedProfileGeometry(bowl, {
        sides: 32,
        smoothAngle: Math.PI,
      }),
    ]
    for (let index = 0; index < feet.count; index++) {
      // A foot stands out along x until it is turned toward the front, then on round by a third each.
      const around = -Math.PI / 2 + index * Math.PI * 2 / feet.count
      const toe = new SphereGeometry(0.011, 8, 6)
      toe.scale(1.2, 0.85, 1.1)
      toe.translate(0.136, 0.00935, 0)
      toe.rotateY(around)
      parts.push(sweptBar(bracketSpine(), around), toe)
    }
    this.metal = mergeParts(parts)
    const outline = [
      [0, 0],
      [0.125, 0],
      [0.12, band.top],
      ...cupProfile().map(([radius, y]) => [radius, y] as const),
      ...arc([lip.radius, lip.y], lip.tube, -Math.PI / 4, Math.PI, 6),
      ...bowl.slice(0, -1).toReversed(),
    ] satisfies Array<Point>
    // A plain lathe: the collider only needs the outline, and a revolved profile cannot be cloned, which welding asks of it.
    this.collision = new LatheGeometry(outline.map(([radius, y]) => new Vector2(radius, y)), 32)
  }

  dispose() {
    this.metal.dispose()
    this.collision.dispose()
  }
}
