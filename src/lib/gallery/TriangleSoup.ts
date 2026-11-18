import {BufferGeometry, Float32BufferAttribute, Vector3} from 'three/webgpu'

/** Collects triangles and winds each of them to face along the normals of its corners. */
export default class TriangleSoup {
  /** the values of the attributes beyond position, normal and uv, by name */
  readonly extras: ReadonlyMap<string, {
    itemSize: number
    values: Array<number>
  }>
  readonly indices: Array<number> = []
  readonly normals: Array<number> = []
  readonly positions: Array<number> = []
  readonly uvs: Array<number> = []

  /** `extras` names further attributes every vertex carries, by their item size. */
  constructor(extras: Readonly<Record<string, number>> = {}) {
    this.extras = new Map(Object.entries(extras).map(([name, itemSize]) => [name, {
      itemSize,
      values: [],
    }]))
  }

  /** Adds a vertex and returns its index, with the values of every further attribute. */
  add(position: Vector3, normal: Vector3, uv: readonly [number, number], extras: Readonly<Record<string, ReadonlyArray<number>>> = {}) {
    this.positions.push(position.x, position.y, position.z)
    this.normals.push(normal.x, normal.y, normal.z)
    this.uvs.push(...uv)
    for (const [name, {itemSize, values}] of this.extras) {
      const value = extras[name] as ReadonlyArray<number> | undefined
      if (value?.length !== itemSize) {
        throw new RangeError(`Every vertex needs ${itemSize} values of ${name}.`)
      }
      values.push(...value)
    }
    return this.positions.length / 3 - 1
  }

  /** Adds a quad of four corners in order round it, as two triangles. */
  quad(a: number, b: number, c: number, d: number) {
    this.triangle(a, b, c)
    this.triangle(a, c, d)
  }

  toGeometry() {
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    for (const [name, {itemSize, values}] of this.extras) {
      geometry.setAttribute(name, new Float32BufferAttribute(values, itemSize))
    }
    geometry.setIndex(this.indices)
    return geometry
  }

  /** Adds a triangle, skipping it if it has no area. */
  triangle(a: number, b: number, c: number) {
    const corner = (index: number) => new Vector3(this.positions[index * 3], this.positions[index * 3 + 1], this.positions[index * 3 + 2])
    const [pa, pb, pc] = [corner(a), corner(b), corner(c)]
    const face = pb.sub(pa).cross(pc.sub(pa))
    if (face.lengthSq() < 1e-14) {
      return
    }
    const normal = [a, b, c].reduce((sum, index) => sum.add(new Vector3(this.normals[index * 3], this.normals[index * 3 + 1], this.normals[index * 3 + 2])), new Vector3)
    if (face.dot(normal) >= 0) {
      this.indices.push(a, b, c)
    } else {
      this.indices.push(a, c, b)
    }
  }
}
