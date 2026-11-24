import type {Point, Polygon, Polygons} from './openings/lib/polygons.ts'

import {getBoundsD} from 'clipper2-ts'
import {BufferAttribute, BufferGeometry, ShapeUtils, Vector2} from 'three/webgpu'

import {point, rectangle, subtractShapes} from './openings/lib/polygons.ts'

/** how large the tiles are that the slab’s faces are triangulated in one by one, in meters: earcut bridges every hole of a shape into its outline one after the other, which takes ever longer the more holes it has, and a large field of openings has thousands */
const tileSize = 1

/**
 * The Studio’s ceiling, relative to the room’s origin: a level slab over the walls, `slab` thick over its underside at `height`, cut through by the holes of its openings, its sides round every hole facing into it and round its edge facing out.
 * Its underside and top are triangulated a tile at a time, their corners shared within a tile, and every side is a quad of its own.
 */
export default function ceilingGeometry({height, holes, size: [width, depth], slab}: {
  height: number
  /** the openings, x along the room’s x and y along its z, counterclockwise */
  holes: Polygons
  /** the floor plan the slab covers, centered on the origin */
  size: readonly [width: number, depth: number]
  slab: number
}) {
  const top = height + slab
  // Every tile’s shapes triangulated first, so the buffers are made once at their full size.
  const faces: Array<{
    corners: Array<Vector2>
    triangles: Array<Array<number>>
  }> = []
  const bounds = holes.map(hole => getBoundsD(hole))
  const [columns, rows] = [Math.ceil(width / tileSize), Math.ceil(depth / tileSize)]
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const [left, right] = [-width / 2 + width * column / columns, -width / 2 + width * (column + 1) / columns]
      const [near, far] = [-depth / 2 + depth * row / rows, -depth / 2 + depth * (row + 1) / rows]
      const tile = rectangle(point((left + right) / 2, (near + far) / 2), right - left, far - near)
      const touching = holes.filter((_, index) => bounds[index].left <= right && bounds[index].right >= left && bounds[index].top <= far && bounds[index].bottom >= near)
      for (const shape of subtractShapes([tile], touching)) {
        const contour = shape.outline.map(({x, y}) => new Vector2(x, y))
        const inner = shape.holes.map(hole => hole.map(({x, y}) => new Vector2(x, y)))
        const triangles = ShapeUtils.triangulateShape(contour, inner)
        faces.push({
          corners: [...contour, ...inner.flat()],
          triangles,
        })
      }
    }
  }
  // Counterclockwise round a hole keeps it on the left, clockwise round the slab’s edge the outside.
  const rims: Array<Polygon> = [...holes, rectangle(point(0, 0), width, depth).toReversed()]
  const edges = rims.reduce((sum, rim) => sum + rim.length, 0)
  const cornerCount = faces.reduce((sum, face) => sum + face.corners.length * 2, 0) + edges * 4
  const indexCount = faces.reduce((sum, face) => sum + face.triangles.length * 6, 0) + edges * 6
  const positions = new Float32Array(cornerCount * 3)
  const normals = new Float32Array(cornerCount * 3)
  const uvs = new Float32Array(cornerCount * 2)
  const indices = new Uint32Array(indexCount)
  let [corners, written] = [0, 0]
  /** Adds a corner over a plan point at `level`, facing along `normalX`, `normalY` and `normalZ`, its index returned. */
  const corner = (x: number, z: number, level: number, normalX: number, normalY: number, normalZ: number, u: number, v: number) => {
    positions[corners * 3] = x
    positions[corners * 3 + 1] = level
    positions[corners * 3 + 2] = z
    normals[corners * 3] = normalX
    normals[corners * 3 + 1] = normalY
    normals[corners * 3 + 2] = normalZ
    uvs[corners * 2] = u
    uvs[corners * 2 + 1] = v
    return corners++
  }
  for (const {corners: plan, triangles} of faces) {
    const below = corners
    for (const {x, y} of plan) {
      corner(x, y, height, 0, -1, 0, x, y)
    }
    const above = corners
    for (const {x, y} of plan) {
      corner(x, y, top, 0, 1, 0, x, y)
    }
    for (const [a, b, c] of triangles) {
      // Counterclockwise in the plan winds a face looking down, as the underside does, and the top the other way.
      const [p, q, r] = [plan[a], plan[b], plan[c]]
      const [first, second] = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) > 0 ? [b, c] : [c, b]
      indices.set([below + a, below + first, below + second, above + a, above + second, above + first], written)
      written += 6
    }
  }
  /** The side along an edge from `from` to `to`, facing to its left in the plan; an edge too short to face any way gets a side of no size. */
  const side = (from: Point, to: Point) => {
    const [dx, dz] = [to.x - from.x, to.y - from.y]
    const length = Math.hypot(dx, dz) || 1
    const [normalX, normalZ] = [-dz / length, dx / length]
    // Along the edge whichever way it runs more, as three’s extrusions lay their sides out.
    const [u, v] = Math.abs(dz) < Math.abs(dx) ? [from.x, to.x] : [from.y, to.y]
    const fromBelow = corner(from.x, from.y, height, normalX, 0, normalZ, u, 0)
    const toBelow = corner(to.x, to.y, height, normalX, 0, normalZ, v, 0)
    const toAbove = corner(to.x, to.y, top, normalX, 0, normalZ, v, slab)
    const fromAbove = corner(from.x, from.y, top, normalX, 0, normalZ, u, slab)
    indices.set([fromBelow, toBelow, fromAbove, toBelow, toAbove, fromAbove], written)
    written += 6
  }
  for (const rim of rims) {
    for (const [index, from] of rim.entries()) {
      side(from, rim[(index + 1) % rim.length])
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return geometry
}
