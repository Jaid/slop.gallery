import {BufferGeometry, Float32BufferAttribute, Vector3} from 'three/webgpu'

export type Ring = Array<Vector3>
/** A rectangular patch of a loft replaced by finer, inward-running loops that share its boundary vertices. */
export type Inlay = {
  bottom: number
  left: number
  recess: (boundary: Ring) => Array<Ring>
  right: number
  top: number
}
export type Hull = {
  points: Float32Array
  volume: number
}
export const ring = (sides: number, point: (angle: number) => Vector3): Ring => Array.from({length: sides}, (_, j) => point(2 * Math.PI * j / sides))
const center = (row: Ring) => row.reduce((sum, p) => sum.add(p), new Vector3).divideScalar(row.length)

/** Closed lofts in one indexed surface. Each ring winds counterclockwise when seen from the last ring. */
export default class Carving {
  readonly hulls: Array<Hull> = []
  private readonly indices: Array<number> = []
  private readonly positions: Array<number> = []

  finish() {
    const geometry = new BufferGeometry
    geometry.setIndex(this.indices)
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.computeVertexNormals()
    return geometry
  }

  /** A convex length of a loft, weighed by its section areas. Small details (toes, eyes or fingers) can extend its envelope without becoming independent colliders. */
  hull(rows: Array<Ring>, details: Array<Ring> = []) {
    const points: Array<number> = []
    let volume = 0
    let previousCenter: Vector3 | undefined
    let previousArea = new Vector3
    for (const row of rows) {
      const mid = center(row)
      const area = new Vector3
      const cross = new Vector3
      for (let j = 0; j < row.length; j++) {
        area.add(cross.crossVectors(row[j], row[(j + 1) % row.length]))
      }
      area.multiplyScalar(0.5)
      if (previousCenter) {
        volume += Math.abs(area.clone().add(previousArea).dot(mid.clone().sub(previousCenter))) * 0.5
      }
      previousCenter = mid
      previousArea = area
    }
    for (const row of [...rows, ...details]) {
      for (let j = 0; j < row.length; j += Math.max(1, Math.floor(row.length / 16))) {
        points.push(row[j].x, row[j].y, row[j].z)
      }
    }
    this.hulls.push({
      points: new Float32Array(points),
      volume,
    })
  }

  loft(rows: Array<Ring>, inlays: Array<Inlay> = []) {
    const loops = rows.map((row, i) => row.map((p, j) => (inlays.some(({top, bottom, left, right}) => i > bottom && i < top && j > left && j < right) ? -1 : this.vertex(p))))
    this.cap(loops[0].toReversed(), rows[0])
    this.cap(loops.at(-1)!, rows.at(-1)!)
    for (let i = 0; i + 1 < rows.length; i++) {
      const cut = inlays.filter(({top, bottom}) => i >= bottom && i < top)
      this.stitch(loops[i], loops[i + 1], cut)
    }
    for (const {bottom, left, recess, right, top} of inlays) {
      const border = <T>(grid: Array<Array<T>>) => [
        ...grid[bottom].slice(left, right),
        ...grid.slice(bottom, top).map(row => row[right]),
        ...grid[top].slice(left + 1, right + 1).toReversed(),
        ...grid.slice(bottom + 1, top + 1).toReversed().map(row => row[left]),
      ]
      let previous = border(loops)
      const inset = recess(border(rows))
      for (const row of inset) {
        const next = row.map(p => this.vertex(p))
        this.stitch(previous, next)
        previous = next
      }
      this.cap(previous, inset.at(-1)!)
    }
  }

  private cap(loop: Array<number>, points: Ring) {
    const tip = this.vertex(center(points))
    for (const [j, point] of loop.entries()) {
      this.indices.push(point, loop[(j + 1) % loop.length], tip)
    }
  }

  /** Zipper two loops by angular fraction. The straight lengths and crown use every other column of the face. */
  private stitch(a: Array<number>, b: Array<number>, cut: Array<Inlay> = []) {
    let i = 0
    let j = 0
    while (i < a.length || j < b.length) {
      const nextA = (i + 1) * b.length
      const nextB = (j + 1) * a.length
      const skip = cut.some(({left, right}) => i >= left && i < right)
      if (nextA <= nextB) {
        if (!skip) {
          this.indices.push(a[i % a.length], a[(i + 1) % a.length], b[j % b.length])
        }
        i++
      }
      if (nextB > nextA) {
        continue
      }
      if (!skip) {
        this.indices.push(a[i % a.length], b[(j + 1) % b.length], b[j % b.length])
      }
      j++
    }
  }

  private vertex(p: Vector3) {
    return this.positions.push(p.x, p.y, p.z) / 3 - 1
  }
}
