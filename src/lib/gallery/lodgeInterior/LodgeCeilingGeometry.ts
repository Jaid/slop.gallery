import type {Vec3} from '../types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Shape, Vector2} from 'three/webgpu'

import lodge, {lodgeOutline} from '../lodge.ts'
import lodgeInterior from './layout.ts'

/** a timber member hanging from the ceiling, built in its own frame */
export type CeilingMember = {
  geometry: BufferGeometry
  name: string
  /** where its frame sits, in the room’s frame with the ceiling at y = 0 */
  position: Vec3
  /** turn of its frame around y */
  yaw: number
}
type Point = readonly [number, number]
/** the side of a line in the plan that a member keeps: points `p` with (p − point) · normal ≥ 0 */
type HalfPlane = {
  normal: Point
  point: Point
}

/** how far members reach into the walls past their log faces, short of the walls’ middles */
const wallTuck = 0.055
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1]
const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]
/** The part of a convex polygon on the kept side of a half plane. */
function clip(polygon: ReadonlyArray<Point>, {normal, point}: HalfPlane) {
  const side = (p: Point) => dot(minus(p, point), normal)
  const result: Array<Point> = []
  for (const [i, a] of polygon.entries()) {
    const b = polygon[(i + 1) % polygon.length]
    const [sideA, sideB] = [side(a), side(b)]
    if (sideA >= 0) {
      result.push(a)
    }
    if (sideA * sideB >= 0) {
      continue
    }
    const t = sideA / (sideA - sideB)
    result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return result
}
/** The half planes inside a convex outline, each edge moved inward by `inset`. */
function insideOutline(outline: ReadonlyArray<Point>, inset: number): Array<HalfPlane> {
  const centroid: Point = [outline.reduce((sum, [x]) => sum + x, 0) / outline.length, outline.reduce((sum, [, z]) => sum + z, 0) / outline.length]
  return outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]
    const length = Math.hypot(...minus(b, a))
    const normal: Point = [(a[1] - b[1]) / length, (b[0] - a[0]) / length]
    const inward: Point = dot(minus(centroid, a), normal) < 0 ? [-normal[0], -normal[1]] : normal
    return {
      normal: inward,
      point: [a[0] + inward[0] * inset, a[1] + inward[1] * inset],
    }
  })
}
/**
 * A member of `width` by `height` hanging from the ceiling, running from `from` toward `to` in the plan and cut off by every half plane it leaves.
 *
 * Its geometry runs along its own +x from `from`, so the timber’s grain, mapped in each mesh’s frame, follows it.
 */
function member(name: string, from: Point, to: Point, [width, height]: readonly [number, number], bounds: ReadonlyArray<HalfPlane>): CeilingMember {
  const length = Math.hypot(...minus(to, from))
  const along: Point = [(to[0] - from[0]) / length, (to[1] - from[1]) / length]
  const across: Point = [-along[1], along[0]]
  const rectangle = ([[0, -width / 2], [length, -width / 2], [length, width / 2], [0, width / 2]] as const).map(([x, z]): Point => [from[0] + along[0] * x + across[0] * z, from[1] + along[1] * x + across[1] * z])
  const footprint = bounds.reduce(clip, rectangle).map(point => minus(point, from))
  // The shape’s y turns into −z once the extrusion is stood upright.
  const shape = new Shape(footprint.map(point => new Vector2(dot(point, along), -dot(point, across))))
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  })
  return {
    name,
    geometry: geometry.rotateX(-Math.PI / 2).translate(0, -height, 0),
    position: [from[0], 0, from[1]],
    // Turns the frame’s +x onto the run and its +z onto `across`.
    yaw: Math.atan2(-along[1], along[0]),
  }
}

/**
 * The hewn timber under the Lodge’s ceiling, in the room’s frame with the ceiling at y = 0.
 *
 * Beams cross the room from wall to wall, the first as the header across the bay’s mouth.
 */
export default class LodgeCeilingGeometry {
  readonly members: Array<CeilingMember>

  constructor() {
    const {beams} = lodgeInterior
    const plan = lodgeOutline.map(([x, z]): Point => [x - lodge.center[0], z - lodge.center[1]])
    const walls = insideOutline(plan, wallTuck)
    const reach = lodge.size[0] + lodge.size[1]
    this.members = beams.z.map(z => member('lodge-beam', [-reach, z], [reach, z], beams.size, walls))
  }

  dispose() {
    for (const {geometry} of this.members) {
      geometry.dispose()
    }
  }
}
