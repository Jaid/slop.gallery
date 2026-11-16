import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, Float32BufferAttribute, Vector3} from 'three/webgpu'

/** Bend local X around a vertical axis at Z = radius, preserving sharp profile edges. */
export function bendGeometry(geometry: BufferGeometry, radius: number) {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const normal = new Vector3
  for (let i = 0; i < positions.count; i++) {
    const angle = positions.getX(i) / radius
    const depth = positions.getZ(i)
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    positions.setXYZ(i, (radius - depth) * sin, positions.getY(i), radius - (radius - depth) * cos)
    // Inverse-transpose of the bend Jacobian, not averaged triangle normals:
    // smooth around the bend, hard at the edges and tangent at both joins.
    normal.fromBufferAttribute(normals, i)
    normal.x /= 1 - depth / radius
    normals.setXYZ(i, normal.x * cos - normal.z * sin, normal.y, normal.x * sin + normal.z * cos)
    normal.fromBufferAttribute(normals, i).normalize()
    normals.setXYZ(i, normal.x, normal.y, normal.z)
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function curveSegments(width: number, radius: number) {
  return Math.max(1, Math.ceil(Math.abs(width / radius) * 16))
}

/**
 * Splits every triangle where it crosses one of the planes x = `origin` + k · `step`, in place, so that {@link bendGeometry} curves long faces, like those CSG leaves beside an opening, instead of leaving them straight chords.
 * Every attribute is interpolated along the cut edges, normals renormalized; the result is indexed anew, without groups.
 */
export function sliceAlongX(geometry: BufferGeometry, step: number, origin = 0) {
  const names = Object.keys(geometry.attributes)
  const sources = names.map(name => geometry.getAttribute(name))
  const offsets = sources.map((_, index) => sources.slice(0, index).reduce((sum, attribute) => sum + attribute.itemSize, 0))
  const x = offsets[names.indexOf('position')]
  const normal = names.indexOf('normal')
  const outputs = sources.map((): Array<number> => [])
  const index = geometry.getIndex()
  const count = index ? index.count : sources[0].count
  type Vertex = Array<number>
  const read = (corner: number): Vertex => {
    const vertex = index ? index.getX(corner) : corner
    return sources.flatMap(attribute => Array.from({length: attribute.itemSize}, (_, component) => attribute.getComponent(vertex, component)))
  }
  // Corners with equal attributes, like a cut shared by both sides of its plane, share one vertex.
  const indices: Array<number> = []
  const known = new Map<string, number>
  const add = (vertex: Vertex) => {
    const key = vertex.join()
    let added = known.get(key)
    if (added === undefined) {
      added = known.size
      known.set(key, added)
      for (const [attribute, output] of outputs.entries()) {
        const values = vertex.slice(offsets[attribute], offsets[attribute] + sources[attribute].itemSize)
        const length = attribute === normal ? Math.hypot(...values) || 1 : 1
        output.push(...values.map(value => value / length))
      }
    }
    return added
  }
  const emit = (polygon: ReadonlyArray<Vertex>) => {
    for (let i = 1; i < polygon.length - 1; i++) {
      indices.push(...[polygon[0], polygon[i], polygon[i + 1]].map(add))
    }
  }
  const tolerance = 1e-7
  for (let corner = 0; corner < count; corner += 3) {
    let polygon = [read(corner), read(corner + 1), read(corner + 2)]
    const xs = polygon.map(vertex => vertex[x])
    const planes: Array<number> = []
    for (let k = Math.ceil((Math.min(...xs) - origin) / step); origin + k * step < Math.max(...xs) - tolerance; k++) {
      if (origin + k * step <= Math.min(...xs) + tolerance) {
        continue
      }
      planes.push(origin + k * step)
    }
    for (const plane of planes) {
      const below: Array<Vertex> = []
      const above: Array<Vertex> = []
      for (const [i, a] of polygon.entries()) {
        const b = polygon[(i + 1) % polygon.length]
        const da = a[x] - plane
        const db = b[x] - plane
        if (da <= 0) {
          below.push(a)
        }
        if (da >= 0) {
          above.push(a)
        }
        // Where the edge to the next corner crosses the plane, both sides get the crossing.
        if (da * db >= 0) {
          continue
        }
        const t = da / (da - db)
        const cut = a.map((value, component) => value + (b[component] - value) * t)
        cut[x] = plane
        below.push(cut)
        above.push(cut)
      }
      if (below.length >= 3) {
        emit(below)
      }
      polygon = above
    }
    if (polygon.length >= 3) {
      emit(polygon)
    }
  }
  // The counts of groups and the draw range would leave out the triangles the cuts add.
  geometry.clearGroups()
  geometry.setDrawRange(0, Infinity)
  for (const [i, name] of names.entries()) {
    geometry.setAttribute(name, new Float32BufferAttribute(outputs[i], sources[i].itemSize))
  }
  geometry.setIndex(indices)
  return geometry
}

/** A closed, rectangular-section circular beam; signed radius selects the bend direction. */
export default class CurvedBoxGeometry extends BoxGeometry {
  constructor(width: number, height: number, depth: number, radius: number) {
    if (![width, height, depth, radius].every(Number.isFinite) || Math.min(width, height, depth) <= 0 || Math.abs(radius) <= depth / 2 || width / Math.abs(radius) > Math.PI * 2) {
      throw new RangeError('A curved box needs positive dimensions, a radius outside its section and at most one revolution.')
    }
    super(width, height, depth, curveSegments(width, radius))
    bendGeometry(this, radius)
  }
}
