import type {Node} from 'three/webgpu'

import {attribute, cameraPosition, float, max, modelWorldMatrixInverse, mx_noise_float, normalLocal, positionLocal, select, uv, vec2, vec3, vec4} from 'three/tsl'

import {frameShapeAttribute, ornamentMember} from '../frameGeometry.ts'

/** what frame materials know about the point they shade, see {@link frameSurface} */
export type FrameSurface = ReturnType<typeof frameSurface>

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

/**
 * What frame materials know about the point they shade, from the attributes `frameGeometry.ts` gives every part of a frame.
 *
 * Read it inside a material’s constructor: the nodes belong to the material that uses them.
 */
export function frameSurface() {
  const shape = attribute<'vec4'>(frameShapeAttribute, 'vec4')
  const coordinates = uv()
  const member = shape.x
  const isOrnament = member.greaterThanEqual(ornamentMember - 0.5)
  const along = coordinates.x
  const across = coordinates.y
  const openingHalf = shape.w
  const halfLength = openingHalf.add(shape.y)
  const side = member.round()
  const vertical = side.equal(1).or(side.equal(3))
  return {
    /** half the opening’s width and half its height, on the members, from which patterns find the corners of the whole frame */
    opening: select(vertical, vec2(positionLocal.x.abs().sub(shape.y), openingHalf), vec2(openingHalf, positionLocal.y.abs().sub(shape.y))),
    /** meters along the member from its middle, or the ornament’s own x */
    along,
    /** meters along the profile from the sight edge, or the ornament’s own y */
    across,
    /** from −1 on a sharp ridge to 1 deep in a hollow */
    cavity: shape.z,
    /** 1 on ornaments, 0 on the members */
    isOrnament: select(isOrnament, float(1), float(0)),
    /** the member, 0 to 3 clockwise from the top, or {@link ornamentMember} and up for ornaments */
    member,
    /** how far out past the opening the point lies, on the members */
    reach: shape.y,
    /** how far along the member the point lies from the nearer miter, on the members */
    toCorner: halfLength.sub(along.abs()),
    /** half the member’s length where the point lies, from miter to miter */
    halfLength,
    /** half the opening’s side the member runs along, the same all across the member */
    openingHalf,
    /** a value from 0 to 1 of its own for every member and every kind of ornament, for giving each piece its own tone */
    piece: mx_noise_float(vec3(member.mul(17.31), 3.7, 1.9)).mul(0.5).add(0.5),
    /** the frame’s local position, its middle at the work’s */
    position: positionLocal,
    /** the coordinates along and across, in meters */
    plane: vec2(along, across),
  }
}

/** Where a point on the members lies from the nearest corner of the frame `reach` meters out past the opening along both of its members, in meters as the viewer sees the frame: x to the right and y up. */
export function fromCorner(surface: FrameSurface, reach: number) {
  const p = surface.position.xy
  return p.sub(p.sign().mul(surface.opening.add(reach)))
}

/**
 * Looking into a frame as if it were clear: the point the view ray through the shaded point reaches `depth` meters below its surface, in the frame’s own space, for patterns that lie deep inside it and slide against each other as the viewer moves.
 * Grazing views would run far along the surface before they got that deep; they reach at most about three times the depth.
 */
export function viewBelow(surface: FrameSurface) {
  const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const ray = surface.position.sub(eye).normalize().toVar('belowRay')
  const slant = ray.dot(normalLocal).negate().max(0.3).toVar('belowSlant')
  return (depth: number) => surface.position.add(ray.mul(float(depth).div(slant)))
}

/**
 * Where a point in the frame’s plane lies round the opening of half width and half height `opening`, without the seams `along` has in the miters: how far out past the opening it lies, as the members’ `reach` does, and how far round the rectangle through it, clockwise from that rectangle’s top left corner, with the rectangle’s whole length round.
 * Any point will do, also one a view ray reaches behind the surface, so patterns can lie deep inside a frame and still run on through its miters.
 */
export function aroundOpening(point: Vec2, opening: Vec2) {
  const out = point.abs().sub(opening).toVar('aroundOut')
  const reach = max(out.x, out.y)
  const a = opening.x.add(reach)
  const b = opening.y.add(reach)
  const distance = select(out.y.greaterThanEqual(out.x), select(point.y.greaterThan(0), point.x.add(a), a.mul(3).add(b.mul(2)).sub(point.x)), select(point.x.greaterThan(0), a.mul(2).add(b).sub(point.y), a.mul(4).add(b.mul(3)).add(point.y)))
  return {
    distance,
    perimeter: a.add(b).mul(4),
    reach,
  }
}

/** A point on a circle `length` meters round for a `distance` round the frame of the `perimeter` {@link aroundOpening} found, so noise sampled there closes on itself without a seam and its features are about as long, in meters, as they are along the frame. */
export function aroundLoop(distance: Float, perimeter: Float, length: Float) {
  const angle = distance.div(perimeter).mul(Math.PI * 2)
  return vec2(angle.cos(), angle.sin()).mul(length.div(Math.PI * 2))
}

/**
 * A period close to `period` that fits a whole number of times, or a whole and a half with `half`, into each member from its middle to its miter `reach` meters out past the opening, so a pattern along the members meets itself in the miters.
 * `openingHalf` is {@link frameSurface}’s; the period is the same all across the member, so a band of pattern stays straight, and only meets exactly at the reach it was fitted for.
 */
export function fittedPeriod(openingHalf: Float, period: number, reach: number, half = false) {
  const length = openingHalf.add(reach)
  const count = half ? max(length.div(period).sub(0.5).round(), float(0)).add(0.5) : max(length.div(period).round(), float(1))
  return length.div(count)
}
