import {Vector3} from 'three/webgpu'

export type Hull = {
  points: Float32Array
  /** fraction of the sculpture’s mass borne by this part */
  share: number
}

export const tau = 2 * Math.PI

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function gaussian(distance: number, sigma: number) {
  const ratio = distance / sigma
  return Math.exp(-0.5 * ratio * ratio)
}

export function superGaussian(distance: number, radius: number, power = 4) {
  return Math.exp(-((Math.abs(distance) / radius) ** power))
}

/** Builds a convex hull descriptor from sampled 3D points and an estimated volume weight. */
export function makeHull(points: ReadonlyArray<Vector3>, weight: number): Hull {
  const flat = new Float32Array(points.length * 3)
  for (const [i, point] of points.entries()) {
    flat[i * 3] = point.x
    flat[i * 3 + 1] = point.y
    flat[i * 3 + 2] = point.z
  }
  return {
    points: flat,
    share: weight,
  }
}

/** Sweeps an elliptical/custom cross-section along a polyline spine using parallel-transport frames. */
export function sweepTube(
  spine: ReadonlyArray<Vector3>,
  sides: number,
  radiusAt: (t: number, angle: number, index: number) => readonly [number, number],
  referenceUp = new Vector3(0, 0, 1),
) {
  const count = spine.length
  const tangents: Array<Vector3> = []
  for (let i = 0; i < count; i++) {
    const prev = spine[Math.max(0, i - 1)]
    const next = spine[Math.min(count - 1, i + 1)]
    tangents.push(next.clone().sub(prev).normalize())
  }
  const firstT = tangents[0]
  let normal = referenceUp.clone().addScaledVector(firstT, -referenceUp.dot(firstT))
  if (normal.lengthSq() < 1e-6) {
    normal = new Vector3(1, 0, 0)
    normal.addScaledVector(firstT, -firstT.x)
  }
  normal.normalize()
  const rings: Array<Array<Vector3>> = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const tangent = tangents[i]
    if (i > 0) {
      normal = normal.clone().addScaledVector(tangent, -normal.dot(tangent))
      if (normal.lengthSq() > 1e-8) {
        normal.normalize()
      }
    }
    const binormal = tangent.clone().cross(normal).normalize()
    const ring: Array<Vector3> = []
    for (let j = 0; j < sides; j++) {
      const angle = tau * j / sides
      const [rn, rb] = radiusAt(t, angle, i)
      ring.push(spine[i].clone().addScaledVector(normal, rn * Math.cos(angle)).addScaledVector(binormal, rb * Math.sin(angle)))
    }
    rings.push(ring)
  }
  return rings
}

/** Collects closed, outward-facing indexed mesh parts into one BufferGeometry. */
export class MeshBuilder {
  readonly indices: Array<number> = []
  readonly positions: Array<number> = []

  /** Adds a lofted tube of equal-length rings with optional pole caps, automatically ensuring outward CCW winding. */
  addClosedLoft(rings: ReadonlyArray<ReadonlyArray<Vector3>>, bottomCap?: Vector3, topCap?: Vector3) {
    const startIndex = this.indices.length
    const ringCount = rings.length
    const sides = rings[0].length
    const ringIndices = rings.map(ring => ring.map(p => this.vertex(p)))
    for (let r = 0; r < ringCount - 1; r++) {
      const a = ringIndices[r]
      const b = ringIndices[r + 1]
      for (let j = 0; j < sides; j++) {
        const k = (j + 1) % sides
        this.indices.push(a[j], a[k], b[k], a[j], b[k], b[j])
      }
    }
    if (bottomCap) {
      const center = this.vertex(bottomCap)
      const first = ringIndices[0]
      for (let j = 0; j < sides; j++) {
        this.indices.push(center, first[(j + 1) % sides], first[j])
      }
    }
    if (topCap) {
      const center = this.vertex(topCap)
      const last = ringIndices[ringCount - 1]
      for (let j = 0; j < sides; j++) {
        this.indices.push(center, last[j], last[(j + 1) % sides])
      }
    }
    // Verify signed tetrahedral volume of the added closed shell; flip triangle winding if negative.
    if (this.signedVolume(startIndex, this.indices.length) < 0) {
      for (let i = startIndex; i < this.indices.length; i += 3) {
        const tmp = this.indices[i + 1]
        this.indices[i + 1] = this.indices[i + 2]
        this.indices[i + 2] = tmp
      }
    }
    return this.signedVolume(startIndex, this.indices.length)
  }

  /** Signed tetrahedral volume of the triangles in [start, end). */
  signedVolume(start = 0, end = this.indices.length) {
    const a = new Vector3
    const b = new Vector3
    const c = new Vector3
    let volume = 0
    for (let i = start; i < end; i += 3) {
      const ia = this.indices[i] * 3
      const ib = this.indices[i + 1] * 3
      const ic = this.indices[i + 2] * 3
      a.set(this.positions[ia], this.positions[ia + 1], this.positions[ia + 2])
      b.set(this.positions[ib], this.positions[ib + 1], this.positions[ib + 2])
      c.set(this.positions[ic], this.positions[ic + 1], this.positions[ic + 2])
      volume += a.dot(b.cross(c)) / 6
    }
    return volume
  }

  vertex(p: Vector3) {
    return this.positions.push(p.x, p.y, p.z) / 3 - 1
  }
}
