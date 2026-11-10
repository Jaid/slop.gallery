import type {BufferGeometry} from 'three/webgpu'

import {Float32BufferAttribute, BufferGeometry as Geometry, Vector3} from 'three/webgpu'

/** Where a stream is `age` seconds after it left its nozzle, in the vertical plane through the fountain’s axis. */
export type StreamPath = {
  /** distance from the axis */
  radius: (age: number) => number
  /** radius of the water’s cross-section, which swells as the stream slows and thins as it accelerates again */
  thickness: (age: number) => number
  /** height above the floor */
  y: (age: number) => number
}

export type WaterStreamOptions = {
  /** age of the water at the far end, in seconds */
  duration: number
  /** how many points run along the stream; more make a long arc bend smoothly */
  samples: number
  /** how many points go around the stream */
  sides: number
}

const epsilon = 1e-4

/**
 * Tags a stream with how far along its flight each vertex is (0 at the mouth, 1 at the pool), how much air it has taken in and that it is a closed body of water rather than an open sheet.
 */
export function streamWater(geometry: BufferGeometry, air: (fall: number) => number) {
  const uv = geometry.getAttribute('uv')
  const fall = new Float32Array(uv.count)
  const airTaken = new Float32Array(uv.count)
  const dense = new Float32Array(uv.count)
  dense.fill(1)
  const duration = Math.max(...Array.from({length: uv.count}, (_, i) => uv.getY(i)))
  for (let i = 0; i < uv.count; i++) {
    const progress = duration ? uv.getY(i) / duration : 0
    fall[i] = progress
    airTaken[i] = air(progress)
  }
  geometry.setAttribute('waterFall', new Float32BufferAttribute(fall, 1))
  geometry.setAttribute('waterAir', new Float32BufferAttribute(airTaken, 1))
  geometry.setAttribute('waterDense', new Float32BufferAttribute(dense, 1))
  // A jet has no tongues: every point of its surface is equally wet.
  const rib = new Float32Array(uv.count)
  rib.fill(0.5)
  geometry.setAttribute('waterRib', new Float32BufferAttribute(rib, 1))
  const hem = new Float32Array(uv.count)
  for (let i = 0; i < uv.count; i++) {
    hem[i] = duration ? uv.getY(i) / duration : 0
  }
  geometry.setAttribute('waterHem', new Float32BufferAttribute(hem, 1))
  return geometry
}

/**
 * A tapered tube of water swept along a ballistic path around the fountain’s axis.
 *
 * The path lies in a vertical plane, so every cross-section has an exact frame – within the plane and across it – and the tube shades round without welding normals. UV v is the water’s age in seconds, like the overflowing sheets, so one material can run streaks along sheets, ring jets and the central column alike.
 */
export default class WaterStreamGeometry extends Geometry {
  override readonly type = 'WaterStreamGeometry'

  constructor(path: StreamPath, {duration, samples, sides}: WaterStreamOptions) {
    super()
    if (!Number.isInteger(samples) || samples < 1 || !Number.isInteger(sides) || sides < 3) {
      throw new RangeError('A water stream needs a positive number of samples and at least three sides.')
    }
    if (!(duration > 0) || !Number.isFinite(duration)) {
      throw new RangeError('A water stream needs a positive duration.')
    }
    const ages = Array.from({length: samples + 1}, (_, i) => duration * i / samples)
    const positions: Array<number> = []
    const normals: Array<number> = []
    const uvs: Array<number> = []
    for (const [index, age] of ages.entries()) {
      const radius = path.radius(age)
      const y = path.y(age)
      const thickness = path.thickness(age)
      if (!(radius >= 0 && thickness >= 0) || !Number.isFinite(y)) {
        throw new RangeError('Water stream paths must stay off the axis and above the floor.')
      }
      // Central differences inside, one-sided at both ends.
      const before = ages[Math.max(0, index - 1)]
      const after = ages[Math.min(ages.length - 1, index + 1)]
      const span = Math.max(epsilon, after - before)
      const dr = (path.radius(after) - path.radius(before)) / span
      const dy = (path.y(after) - path.y(before)) / span
      // In-plane normal of the tangent (dr, dy), and the direction across the plane.
      const length = Math.hypot(dr, dy) || 1
      const radial = -dy / length
      const vertical = dr / length
      for (let side = 0; side < sides; side++) {
        // The path lies in the z = 0 plane, so the cross-section turns from the in-plane normal toward +z.
        const angle = side / sides * Math.PI * 2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const nx = radial * cos
        const ny = vertical * cos
        const nz = sin
        positions.push(radius + thickness * nx, y + thickness * ny, thickness * nz)
        normals.push(nx, ny, nz)
        uvs.push(side / sides, age)
      }
    }
    const indices: Array<number> = []
    const [p, q, r, face, normal, sum] = Array.from({length: 6}, () => new Vector3)
    /** Winds a triangle so that its front follows the tube’s outward normals, wherever the stream is in its flight. */
    const push = (first: number, second: number, third: number) => {
      p.fromArray(positions, first * 3)
      q.fromArray(positions, second * 3).sub(p)
      r.fromArray(positions, third * 3).sub(p)
      face.crossVectors(q, r)
      sum.fromArray(normals, first * 3).add(normal.fromArray(normals, second * 3)).add(normal.fromArray(normals, third * 3))
      if (face.dot(sum) >= 0) {
        indices.push(first, second, third)
      } else {
        indices.push(first, third, second)
      }
    }
    for (let row = 0; row < samples; row++) {
      for (let side = 0; side < sides; side++) {
        const next = (side + 1) % sides
        const a = row * sides + side
        const b = row * sides + next
        const c = (row + 1) * sides + next
        const d = (row + 1) * sides + side
        push(a, b, c)
        push(a, c, d)
      }
    }
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    this.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    this.setIndex(indices)
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}
