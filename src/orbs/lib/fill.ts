import type {ColorRepresentation, Node} from 'three/webgpu'

import {float, fwidth, select, vec2, vec3} from 'three/tsl'
import {Color} from 'three/webgpu'

/** a color as a vector in the working color space, for mixing with other vectors */
export function rgb(value: ColorRepresentation) {
  const {r, g, b} = new Color(value)
  return vec3(r, g, b)
}

/** the point turned by `angle` radians around the y axis */
export function spinAroundY(point: Node<'vec3'>, angle: Node<'float'>) {
  const cosine = angle.cos()
  const sine = angle.sin()
  return vec3(point.x.mul(cosine).sub(point.z.mul(sine)), point.y, point.x.mul(sine).add(point.z.mul(cosine)))
}

/** the 2D point turned by `angle` radians */
export function turn(point: Node<'vec2'>, angle: Node<'float'>) {
  const cosine = angle.cos()
  const sine = angle.sin()
  return vec2(point.x.mul(cosine).sub(point.y.mul(sine)), point.x.mul(sine).add(point.y.mul(cosine)))
}

/** how far along the ray the plane through `center` with the normal `normal` lies; parallel planes lie far away */
export function planeDepth(origin: Node<'vec3'>, direction: Node<'vec3'>, center: Node<'vec3'>, normal: Node<'vec3'>) {
  const facing = direction.dot(normal)
  const guarded = select(facing.greaterThanEqual(0), facing.max(1e-5), facing.min(-1e-5))
  return center.sub(origin).dot(normal).div(guarded)
}

/**
 * Where the ray meets an ellipsoid with the given center, axes (unit, perpendicular) and radii along them, and how much of the pixel it covers.
 * The coverage fades over a pixel at the outline, so small things stay antialiased.
 */
export function ellipsoidHit(origin: Node<'vec3'>, direction: Node<'vec3'>, center: Node<'vec3'>, axes: [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>], radii: [Node<'float'>, Node<'float'>, Node<'float'>] | [number, number, number]) {
  const offset = origin.sub(center)
  const o = vec3(offset.dot(axes[0]).div(radii[0]), offset.dot(axes[1]).div(radii[1]), offset.dot(axes[2]).div(radii[2]))
  const d = vec3(direction.dot(axes[0]).div(radii[0]), direction.dot(axes[1]).div(radii[1]), direction.dot(axes[2]).div(radii[2]))
  const a = d.dot(d)
  const b = o.dot(d)
  // the squared distance of the ray’s nearest approach to the middle, in radii of the ellipsoid
  const nearest = o.sub(d.mul(b.div(a))).lengthSq()
  const edge = float(1).sub(nearest)
  const depth = b.negate().sub(b.mul(b).sub(a.mul(o.dot(o).sub(1))).max(0).sqrt()).div(a)
  return {
    coverage: coverage(edge),
    depth,
  }
}

/** how much of the pixel a shape covers, from a value that is positive inside it and crosses 0 at its outline, faded over about a pixel */
export function coverage(inside: Node<'float'>) {
  const pixel = fwidth(inside).max(1e-5)
  return inside.div(pixel).add(0.5).clamp()
}
