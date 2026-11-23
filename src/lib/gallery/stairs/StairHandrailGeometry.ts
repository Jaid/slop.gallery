import type StairTurn from './StairTurn.ts'

import {BufferGeometry, Float32BufferAttribute, Vector3} from 'three/webgpu'

/** half the path length over which a grade change is eased into a parabolic vertical curve */
export const stairHandrailBend = 0.75

/** height offset of a parabolic vertical curve centered on a grade change, per unit of grade change, `distance` along the path from the change */
export function stairHandrailEase(distance: number) {
  if (Math.abs(distance) >= stairHandrailBend) {
    return 0
  }
  return (distance + stairHandrailBend) ** 2 / (4 * stairHandrailBend) - Math.max(distance, 0)
}

/** One closed rail across two grades and a level bend, with vertical profiles and eased grade changes. */
export default class StairHandrailGeometry extends BufferGeometry {
  constructor(turn: StairTurn, side: 'inner' | 'outer', start: readonly [number, number], end: readonly [number, number]) {
    if (![...start, ...end].every(Number.isFinite) || start[0] >= turn.center[0] || end[0] >= turn.center[0]) {
      throw new RangeError('A stair handrail needs finite flight endpoints before the turn plane.')
    }
    super()
    const inner = side === 'inner'
    const radius = inner ? turn.innerRadius + 0.22 : turn.outerRadius - 0.22
    const centerZ = inner ? turn.innerCenterZ : turn.outerCenterZ
    const half = 0.065 / 2
    const step = stairHandrailBend / 16
    const entry = turn.center[0] - start[0]
    const arc = Math.PI * radius
    const exit = turn.center[0] - end[0]
    const grades = [(turn.top - start[1]) / entry, 0, (end[1] - turn.top) / exit]
    const joins = [entry, entry + arc]
    // Rail height along the horizontal path: straight grades with both changes eased over the same distance on either side.
    const height = (distance: number) => turn.top + 1 + grades[0] * Math.min(distance - entry, 0) + grades[2] * Math.max(distance - entry - arc, 0) + joins.reduce((sum, join, i) => sum + (grades[i + 1] - grades[i]) * stairHandrailEase(distance - join), 0)
    const segments = Math.ceil(arc / step)
    const easeSteps = Math.ceil(stairHandrailBend / step)
    const distances = [
      0,
      ...Array.from({length: easeSteps}, (_, i) => entry - (easeSteps - i) * step),
      ...Array.from({length: segments + 1}, (_, i) => entry + i / segments * arc),
      ...Array.from({length: easeSteps}, (_, i) => entry + arc + (i + 1) * step),
      entry + arc + exit,
    ].filter(distance => distance >= 0 && distance <= entry + arc + exit)
    const {direction} = turn
    const stations = distances.map(distance => {
      const angle = Math.min(Math.max((distance - entry) / radius, 0), Math.PI)
      const along = distance < entry ? distance - entry : Math.max(distance - entry - arc, 0)
      // Right-hand side of the tangent in xz, keeping outward winding whether the turn swings south or north.
      const normal = new Vector3(-direction * Math.sin(angle), 0, Math.cos(angle))
      const tangent = new Vector3(Math.cos(angle), 0, direction * Math.sin(angle))
      const grade = (height(distance + 0.0001) - height(distance - 0.0001)) / 0.0002
      const up = new Vector3(0, 1, 0)
      up.addScaledVector(tangent, -grade).normalize()
      return {
        point: new Vector3(turn.center[0] + Math.sin(angle) * radius + tangent.x * along, height(distance), centerZ - direction * Math.cos(angle) * radius),
        normal,
        up,
        distance,
      }
    })
    const rings = stations.map(({point, normal}) => [
      point.clone().addScaledVector(normal, half).add(new Vector3(0, -half, 0)),
      point.clone().addScaledVector(normal, -half).add(new Vector3(0, -half, 0)),
      point.clone().addScaledVector(normal, -half).add(new Vector3(0, half, 0)),
      point.clone().addScaledVector(normal, half).add(new Vector3(0, half, 0)),
    ])
    const positions: Array<number> = []
    const normals: Array<number> = []
    const uvs: Array<number> = []
    const indices: Array<number> = []
    const quad = (points: Array<Vector3>, faceNormals: Array<Vector3>, from: number, to: number) => {
      const base = positions.length / 3
      for (let i = 0; i < 4; i++) {
        positions.push(...points[i])
        normals.push(...faceNormals[i])
        uvs.push(i < 2 ? from : to, i === 0 || i === 3 ? 0 : half * 2)
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    let distance = 0
    for (let i = 1; i < rings.length; i++) {
      const from = rings[i - 1]
      const to = rings[i]
      const nextDistance = distance + stations[i].point.distanceTo(stations[i - 1].point)
      for (let face = 0; face < 4; face++) {
        const next = (face + 1) % 4
        const points = [from[face], from[next], to[next], to[face]]
        // Bottom, inner side, top and outer side; every face is smooth along the rail, keeping only the profile’s corners crisp.
        const sign = face < 2 ? -1 : 1
        const fromNormal = (face % 2 ? stations[i - 1].normal : stations[i - 1].up).clone().multiplyScalar(sign)
        const toNormal = (face % 2 ? stations[i].normal : stations[i].up).clone().multiplyScalar(sign)
        quad(points, [fromNormal, fromNormal, toNormal, toNormal], distance, nextDistance)
      }
      distance = nextDistance
    }
    // Only the two room ends are capped; there are no internal faces at either landing join.
    const capNormal = new Vector3(-1, 0, 0)
    quad(rings[0].toReversed(), Array.from({length: 4}, () => capNormal), 0, half * 2)
    quad(rings.at(-1)!, Array.from({length: 4}, () => capNormal), 0, half * 2)
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    this.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    this.setIndex(indices)
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}
