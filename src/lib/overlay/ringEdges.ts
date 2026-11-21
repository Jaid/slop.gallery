import type {Vec3} from 'math'

import {Vector3} from 'three/webgpu'

/** A closed ring of segment endpoint pairs in the plane perpendicular to normal. */
export default function ringEdges(center: Readonly<Vec3>, radius: number, normal: Readonly<Vec3>, segments: number) {
  const n = new Vector3(...normal)
  if (!(radius > 0 && Number.isFinite(radius) && Number.isInteger(segments) && segments >= 3 && n.lengthSq() > 0 && Number.isFinite(n.lengthSq()))) {
    throw new RangeError('A circle needs a positive finite radius, a finite nonzero normal and at least three segments.')
  }
  n.normalize()
  const u = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
  u.cross(n).normalize()
  const v = n.clone().cross(u)
  const edges = new Float32Array(segments * 6)
  const point = new Vector3
  for (let i = 0; i < segments; i++) {
    const angle = i * 2 * Math.PI / segments
    point.set(...center).addScaledVector(u, radius * Math.cos(angle)).addScaledVector(v, radius * Math.sin(angle))
    point.toArray(edges, i * 6)
    point.toArray(edges, (i + segments - 1) % segments * 6 + 3)
  }
  return edges
}
