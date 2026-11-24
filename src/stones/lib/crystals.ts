import type {Node} from 'three/webgpu'

import {float, max, min, vec3, vec4} from 'three/tsl'

type Vec3 = Node<'vec3'>

/** Turns `v` by a rotation drawn uniformly from every rotation there is by the three random numbers in 0–1 of `random` (Shoemake’s unit quaternion), so the crystals of a cell lie in no preferred direction. */
export function randomTurn(v: Vec3, random: Vec3) {
  const u = random.x
  const outer = float(1).sub(u).sqrt()
  const inner = u.sqrt()
  const a = random.y.mul(Math.PI * 2)
  const b = random.z.mul(Math.PI * 2)
  const q = vec4(outer.mul(a.sin()), outer.mul(a.cos()), inner.mul(b.sin()), inner.mul(b.cos()))
  const twice = q.xyz.cross(v).mul(2)
  return v.add(twice.mul(q.w)).add(q.xyz.cross(twice))
}

/** A unit vector pointing in a direction drawn uniformly from every direction there is by the first two random numbers in 0–1 of `random`. */
export function randomDirection(random: Vec3) {
  const z = random.x.mul(2).sub(1)
  const around = random.y.mul(Math.PI * 2)
  const radius = float(1).sub(z.mul(z)).max(0).sqrt()
  return vec3(radius.mul(around.cos()), radius.mul(around.sin()), z)
}

/** The signed distance to a box of half-extents `half` round the origin, negative inside. */
export function boxDistance(p: Vec3, half: Vec3) {
  const q = p.abs().sub(half)
  return max(q, 0).length().add(min(max(q.x, max(q.y, q.z)), 0))
}
