import type {Wall} from '../placement/wallGeometry.ts'
import type {BufferGeometry} from 'three/webgpu'

import {BufferAttribute, Vector3} from 'three/webgpu'

const a = new Vector3
const b = new Vector3
const c = new Vector3
const normal = new Vector3
const facing = new Vector3

/**
 * A copy of a wall’s surface, in the wall’s own frame, whose triangles come in two groups for two materials: the faces of the wall itself first, then the reveals lining its openings, which face across the opening rather than out of the wall.
 * A round wall’s face looks toward the center of its bend wherever it has turned round it, and its openings are measured along its curve.
 */
export default function withOpeningReveals(surface: BufferGeometry, wall: Pick<Wall, 'curveRadius' | 'holes'>) {
  const geometry = surface.clone()
  const position = geometry.getAttribute('position')
  const source = geometry.index ? [...geometry.index.array] : Array.from({length: position.count}, (_, index) => index)
  const radius = wall.curveRadius
  const faces: Array<number> = []
  const reveals: Array<number> = []
  for (let index = 0; index < source.length; index += 3) {
    const corners = [source[index], source[index + 1], source[index + 2]] as const
    a.fromBufferAttribute(position, corners[0])
    b.fromBufferAttribute(position, corners[1])
    c.fromBufferAttribute(position, corners[2])
    const x = (a.x + b.x + c.x) / 3
    const y = (a.y + b.y + c.y) / 3
    const z = (a.z + b.z + c.z) / 3
    normal.subVectors(c, b).cross(a.sub(b)).normalize()
    // In the wall’s frame, x runs along it at its middle, z into the room, and its bend centers at z = radius.
    const u = radius ? Math.atan2(x / radius, 1 - z / radius) * radius : x
    if (radius) {
      facing.set(-x, 0, radius - z).normalize().multiplyScalar(Math.sign(radius))
    } else {
      facing.set(0, 0, 1)
    }
    // Across the opening, within its jambs and under its head.
    const lining = Math.abs(normal.dot(facing)) < 0.5 && (wall.holes ?? []).some(hole => Math.abs(u - hole.u) <= hole.width / 2 + 1e-3 && y <= hole.height + 1e-3)
    ;(lining ? reveals : faces).push(...corners)
  }
  const indices = [...faces, ...reveals]
  geometry.setIndex(new BufferAttribute(position.count > 65_535 ? Uint32Array.from(indices) : Uint16Array.from(indices), 1))
  geometry.clearGroups()
  geometry.addGroup(0, faces.length, 0)
  geometry.addGroup(faces.length, reveals.length, 1)
  return geometry
}
