import type {Node} from 'three/webgpu'

import {cameraPosition, cross, mix, modelPosition, positionGeometry, uv, vec2, vec3} from 'three/tsl'

import {portalPoint} from '../base/billboards.ts'
import {splatLift} from './flights.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

/** how far a flying drop’s quad reaches to either side of its line, in its radii, with room for its outline’s antialiasing */
export const dropMargin = 1.25

/** The corner of a quad `length` long that runs back from `head` against `along`, its unit direction, and reaches `width` to either side, turned toward the camera around its line, which `side` crosses. */
export function streakQuad(head: Vec3, along: Vec3, length: Float, radius: Float, width: Float) {
  const side = cross(cameraPosition.sub(modelPosition.add(head)), along).normalize()
  const middle = head.sub(along.mul(length.mul(0.5).sub(radius)))
  return {
    corner: middle.add(along.mul(positionGeometry.y.mul(length))).add(side.mul(positionGeometry.x.mul(width).mul(2))),
    side,
  }
}

/** The inside of a teardrop on a streak quad `length` long and `width` to either side, positive within it, in meters: round at its head of `radius`, tapering back toward its tail to `tail` of it; and where on it the fragment lies, and where the middle of its head is. */
export function teardrop(radius: Float, length: Float, width: Float, tail: Float | number = 0.35) {
  const point = vec2(uv().x.sub(0.5).mul(width).mul(2), uv().y.sub(0.5).mul(length))
  const tip = length.mul(0.5).sub(radius)
  const end = length.mul(-0.5).add(radius.mul(tail))
  const nearest = point.y.clamp(end, tip)
  const thickness = mix(radius.mul(tail), radius, nearest.sub(end).div(tip.sub(end).max(0.0001)))
  return {
    inside: thickness.sub(vec2(point.x, point.y.sub(nearest)).length()),
    point,
    tip,
  }
}

/** The point on the floor, `lift` above it, `along` the wall and `out` into the room from the portal’s middle, in the mesh’s space. */
export function floorPoint(tangent: Vec3, normal: Vec3, floor: Float, along: Float | number, out: Float | number, lift = splatLift) {
  return portalPoint(tangent, normal, along, floor.add(lift), out)
}

/** the world’s up */
export const up = vec3(0, 1, 0)
