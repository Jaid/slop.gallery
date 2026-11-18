import {BufferGeometry, Float32BufferAttribute, Vector3} from 'three/webgpu'

/** Collects triangles and winds each of them to face along the normals of its corners. */
export default class TriangleSoup {
  readonly indices: Array<number> = []
  readonly normals: Array<number> = []
  readonly positions: Array<number> = []
  readonly uvs: Array<number> = []

  /** Adds a vertex and returns its index. */
  add(position: Vector3, normal: Vector3, uv: readonly [number, number]) {
    this.positions.push(position.x, position.y, position.z)
    this.normals.push(normal.x, normal.y, normal.z)
    this.uvs.push(...uv)
    return this.positions.length / 3 - 1
  }

  toGeometry() {
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
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
