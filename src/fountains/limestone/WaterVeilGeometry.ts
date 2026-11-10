import {Float32BufferAttribute, BufferGeometry as Geometry, Vector3} from 'three/webgpu'

/** Where the water of a veil is `age` seconds after it left the lip, in the vertical plane through the fountain’s axis. */
export type VeilPath = {
  radius: (age: number) => number
  y: (age: number) => number
}

export type WaterVeilOptions = {
  /** age of the water at the far end, in seconds */
  duration: number
  /** how far the lobes stand out at the bottom, as a share of the radius */
  lobeDepth: number
  /** how many tongues the veil breaks into */
  lobes: number
  /** how many points run from the lip down */
  samples: number
  /** how many points go around the veil */
  sides: number
}

const tau = Math.PI * 2

/**
 * The sheet pouring over a bowl’s lip, as a skirt that breaks into tongues on its way down.
 *
 * A plain surface of revolution reads as a glass cylinder, so the radius swells along `lobes` tongues and every tongue runs a little longer than its neighbors. Shading normals come from the swept surface itself, so the tongues catch the light along their crests. UV v is the water’s age in seconds, like the streams’, and `waterRib` tells the crests from the folds between them.
 */
export default class WaterVeilGeometry extends Geometry {
  override readonly type = 'WaterVeilGeometry'

  constructor(path: VeilPath, {duration, lobeDepth, lobes, samples, sides}: WaterVeilOptions) {
    super()
    if (!Number.isInteger(samples) || samples < 1 || !Number.isInteger(sides) || sides < 3) {
      throw new RangeError('A water veil needs a positive number of samples and at least three sides.')
    }
    if (!(duration > 0) || !Number.isFinite(duration) || !Number.isInteger(lobes) || lobes < 1 || !(lobeDepth >= 0)) {
      throw new RangeError('A water veil needs a positive duration, a whole number of lobes and a non-negative lobe depth.')
    }
    // Every tongue ends at its own age, so the veil’s hem is ragged.
    const ends = Array.from({length: sides}, (_, side) => 1 - lobeDepth * 0.9 * (0.5 + 0.5 * Math.sin(side / sides * tau * 2.7 + 1.3)))
    const ages = (side: number, sample: number) => duration * ends[side] * sample / samples
    const point = (side: number, sample: number) => {
      const angle = side / sides * tau
      const age = ages(side, sample)
      const tongue = 1 + lobeDepth * Math.cos(lobes * angle) * (sample / samples) ** 1.4
      const radius = path.radius(age) * tongue
      return new Vector3(radius * Math.cos(angle), path.y(age), -radius * Math.sin(angle))
    }
    const positions: Array<number> = []
    const normals: Array<number> = []
    const uvs: Array<number> = []
    const ribs: Array<number> = []
    const hems: Array<number> = []
    const [along, around, normal] = Array.from({length: 3}, () => new Vector3)
    for (let side = 0; side < sides; side++) {
      for (let sample = 0; sample <= samples; sample++) {
        const here = point(side, sample)
        along.subVectors(point(side, Math.min(samples, sample + 1)), point(side, Math.max(0, sample - 1)))
        around.subVectors(point((side + 1) % sides, sample), point((side + sides - 1) % sides, sample))
        normal.crossVectors(around, along)
        // The rim and hem collapse to near-zero tangents; the radial direction is the fallback.
        if (normal.lengthSq() < 1e-16) {
          normal.set(Math.cos(side / sides * tau), 0, -Math.sin(side / sides * tau))
        }
        // The veil must face away from the axis.
        if (normal.x * here.x + normal.z * here.z < 0) {
          normal.negate()
        }
        normal.normalize()
        positions.push(here.x, here.y, here.z)
        normals.push(normal.x, normal.y, normal.z)
        uvs.push(side / sides, ages(side, sample))
        ribs.push(0.5 + 0.5 * Math.cos(lobes * side / sides * tau))
        hems.push(sample / samples)
      }
    }
    const indices: Array<number> = []
    const [p, q, r, face, shading, sum] = Array.from({length: 6}, () => new Vector3)
    /** Winds a triangle so that its front follows the veil’s outward normal. */
    const push = (first: number, second: number, third: number) => {
      p.fromArray(positions, first * 3)
      q.fromArray(positions, second * 3).sub(p)
      r.fromArray(positions, third * 3).sub(p)
      face.crossVectors(q, r)
      sum.fromArray(normals, first * 3).add(shading.fromArray(normals, second * 3)).add(shading.fromArray(normals, third * 3))
      if (face.dot(sum) >= 0) {
        indices.push(first, second, third)
      } else {
        indices.push(first, third, second)
      }
    }
    const row = samples + 1
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides
      for (let sample = 0; sample < samples; sample++) {
        const a = side * row + sample
        const b = next * row + sample
        push(a, b, b + 1)
        push(a, b + 1, a + 1)
      }
    }
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    this.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    this.setAttribute('waterRib', new Float32BufferAttribute(ribs, 1))
    this.setAttribute('waterHem', new Float32BufferAttribute(hems, 1))
    this.setIndex(indices)
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}
