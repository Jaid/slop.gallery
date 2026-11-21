import type {Vec3} from 'math'
import type {BufferGeometry} from 'three/webgpu'

import {Color, Float32BufferAttribute, Vector3} from 'three/webgpu'

export type Hull = {
  points: Float32Array
  share: number
}

/** A station of an elliptical loft: center, then its two radii. The first and last stations are poles. */
export type Station = readonly [x: number, y: number, z: number, width: number, depth: number]
export type Ring = ReadonlyArray<number>
export const tau = 2 * Math.PI

/** Cubic interpolation between hand-placed stations. Mirrors the missing endpoint to keep the tangent predictable at a pole. */
function sample(a: number, b: number, before: number, after: number, t: number) {
  const ab = b - a
  const m = (b - before) * 0.5
  const n = (after - a) * 0.5
  return a + t * (m + t * (3 * ab - 2 * m - n + t * (m + n - 2 * ab)))
}

export default class SahurMesh {
  private readonly colors: Array<number> = []
  private readonly finish: Array<number> = []
  private readonly grain: Array<number> = []
  private readonly indices: Array<number> = []
  private readonly positions: Array<number> = []

  /** Join successive closed rings. A singleton ring is a pole, with no degenerate triangles. */
  band(a: Ring, b: Ring) {
    const sides = Math.max(a.length, b.length)
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides
      if (a.length === 1) {
        this.indices.push(a[0], b[j], b[k])
      } else if (b.length === 1) {
        this.indices.push(a[j], b[0], a[k])
      } else {
        this.indices.push(a[j], b[j], b[k], a[j], b[k], a[k])
      }
    }
  }

  /** Sparse samples of the actual skin for Rapier’s convex decomposition. */
  hull(rings: ReadonlyArray<Ring>, stride = 4) {
    const points: Array<number> = []
    for (const [row, ring] of rings.entries()) {
      if (row % stride && row !== rings.length - 1) {
        continue
      }
      const step = Math.max(1, Math.floor(ring.length / 12))
      for (let i = 0; i < ring.length; i += step) {
        const offset = ring[i] * 3
        points.push(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2])
      }
    }
    return points
  }

  /** Sweep a carved part. The grain runs along the blank, not around the cuts made by the sculptor. */
  loft(stations: ReadonlyArray<Station>, {
    across = [1, 0, 0],
    seed,
    sides = 20,
    steps = 4,
    tint,
  }: {
    across?: Vec3
    seed: number
    sides?: number
    steps?: number
    tint: string
  }) {
    const color = new Color(tint)
    const last = stations.length - 1
    const first = new Vector3(...stations[0].slice(0, 3))
    const axis = new Vector3(...stations[last].slice(0, 3))
    axis.sub(first).normalize()
    const acrossAxis = new Vector3(...across)
    const grainAcross = acrossAxis.clone().addScaledVector(axis, -acrossAxis.dot(axis)).normalize()
    const grainDeep = grainAcross.clone().cross(axis)
    const rings: Array<Array<number>> = []
    const scratch = new Vector3
    const centerAt = (u: number) => {
      const span = Math.min(last - 1, Math.floor(u))
      const a = stations[span]
      const b = stations[span + 1]
      return a.map((value, i) => sample(value, b[i], stations[span - 1]?.[i] ?? 2 * value - b[i], stations[span + 2]?.[i] ?? 2 * b[i] - value, u - span))
    }
    for (let i = 0; i <= last * steps; i++) {
      const u = i / steps
      const [x, y, z, width, depth] = centerAt(u)
      const center = new Vector3(x, y, z)
      const tangent = new Vector3(...centerAt(Math.min(last, u + 0.001)).slice(0, 3))
      tangent.sub(new Vector3(...centerAt(Math.max(0, u - 0.001)).slice(0, 3))).normalize()
      const wide = acrossAxis.clone().addScaledVector(tangent, -acrossAxis.dot(tangent)).normalize()
      const deep = wide.clone().cross(tangent)
      const ring = Array.from({length: i === 0 || i === last * steps ? 1 : sides}, (_, j) => {
        const angle = tau * j / sides
        const point = center.clone().addScaledVector(wide, width * Math.cos(angle)).addScaledVector(deep, depth * Math.sin(angle))
        point.y = Math.max(0, point.y)
        scratch.copy(point).sub(first)
        const grain = Math.hypot(scratch.dot(grainAcross) + 0.17, scratch.dot(grainDeep) + 0.08)
        return this.vertex(point, color, [scratch.dot(axis), grain, seed])
      })
      if (rings.length) {
        this.band(rings.at(-1)!, ring)
      }
      rings.push(ring)
    }
    return rings
  }

  vertex({x, y, z}: Vector3, tint: Color, [along, across, seed]: Vec3, enamel = 0) {
    this.colors.push(tint.r, tint.g, tint.b)
    this.grain.push(along, across, seed)
    this.finish.push(enamel)
    return this.positions.push(x, y, z) / 3 - 1
  }

  writeTo(geometry: BufferGeometry) {
    geometry.setIndex(this.indices)
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    geometry.setAttribute('sahurGrain', new Float32BufferAttribute(this.grain, 3))
    geometry.setAttribute('sahurEnamel', new Float32BufferAttribute(this.finish, 1))
    geometry.computeVertexNormals()
  }
}
