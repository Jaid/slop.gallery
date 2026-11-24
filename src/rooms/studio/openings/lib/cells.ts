import type {Point, Polygon, Polygons} from './polygons.ts'

import {arc, halfPlane, point, regular, rotate} from './polygons.ts'

/** a ring of cells round the origin between two radii, split into `count` equal sectors, the first starting `offset` radians from +x */
export type Ring = {
  count: number
  inner: number
  offset: number
  outer: number
}

/** The cells of a lattice spanned by `u` and `v` that cover a disc of `radius` round the origin: the parallelogram on every lattice point, its corner on the point, the lattice shifted by `offset`. */
export function latticeCells(u: Point, v: Point, radius: number, offset = point(0, 0)): Polygons {
  const cells: Array<Polygon> = []
  const steps = Math.ceil(radius / Math.min(Math.hypot(u.x, u.y), Math.hypot(v.x, v.y)) * 2) + 2
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const corner = point(offset.x + u.x * i + v.x * j, offset.y + u.y * i + v.y * j)
      const cell = [corner, point(corner.x + u.x, corner.y + u.y), point(corner.x + u.x + v.x, corner.y + u.y + v.y), point(corner.x + v.x, corner.y + v.y)]
      if (cell.some(({x, y}) => Math.hypot(x, y) < radius + Math.hypot(u.x + v.x, u.y + v.y))) {
        cells.push(cell)
      }
    }
  }
  return cells
}

/** Square cells `size` wide, turned `rotation` radians, covering a disc of `radius`, a cell’s corner or middle on the origin as `centered` says. */
export function gridCells(size: number, radius: number, rotation = 0, centered = false): Polygons {
  const offset = centered ? -size / 2 : 0
  return rotate(latticeCells(point(size, 0), point(0, size), radius, point(offset, offset)), rotation)
}

/** Regular hexagons `size` from middle to corner, packed edge to edge, turned `rotation` radians, one on the origin, covering a disc of `radius`. */
export function hexCells(size: number, radius: number, rotation = 0): Polygons {
  const u = point(Math.sqrt(3) * size, 0)
  const v = point(Math.sqrt(3) / 2 * size, 1.5 * size)
  const steps = Math.ceil(radius / size) + 1
  const cells: Array<Polygon> = []
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const center = point(u.x * i + v.x * j, u.y * i + v.y * j)
      if (Math.hypot(center.x, center.y) < radius + size * 2) {
        cells.push(regular(6, size, Math.PI / 6, center))
      }
    }
  }
  return rotate(cells, rotation)
}

/** Equilateral triangles with edges `size` long, packed edge to edge, turned `rotation` radians, covering a disc of `radius`. */
export function triangleCells(size: number, radius: number, rotation = 0): Polygons {
  const height = size * Math.sqrt(3) / 2
  const rows = Math.ceil(radius / height) + 1
  const cells: Array<Polygon> = []
  for (let row = -rows; row < rows; row++) {
    const [bottom, top] = [row * height, (row + 1) * height]
    const shift = row % 2 ? size / 2 : 0
    for (let column = -Math.ceil(radius / size) - 2; column <= Math.ceil(radius / size) + 2; column++) {
      const x = column * size + shift
      cells.push([point(x, bottom), point(x + size, bottom), point(x + size / 2, top)])
      cells.push([point(x + size / 2, top), point(x + size, bottom), point(x + size * 1.5, top)])
    }
  }
  return rotate(cells, rotation)
}

/** The sectors of every ring, each running out along its outer arc and back along its inner one, or a whole disc for a ring that starts at the middle and isn’t split. */
export function ringCells(rings: ReadonlyArray<Ring>): Polygons {
  return rings.flatMap(({count, inner, offset, outer}) => Array.from({length: count}, (_, index) => {
    const from = offset + index / count * Math.PI * 2
    const to = from + Math.PI * 2 / count
    const outside = arc(point(0, 0), outer, from, to)
    if (inner > 0) {
      return [...outside, ...arc(point(0, 0), inner, to, from)]
    }
    return count === 1 ? outside.slice(0, -1) : [point(0, 0), ...outside]
  }))
}

/**
 * The cells of `sites` within the convex `bounds`: every point of a site’s cell lies nearer to it than to any other site.
 * The sites are sorted into square buckets, and each cell is cut by the sites of the buckets round its own, ring by ring outward, until the next ring lies too far to cut it: farther than twice its farthest corner.
 */
export function voronoiCells(sites: ReadonlyArray<Point>, bounds: Polygon): Polygons {
  if (sites.length === 0) {
    return []
  }
  const xs = bounds.map(({x}) => x)
  const ys = bounds.map(({y}) => y)
  const [left, bottom] = [Math.min(...xs), Math.min(...ys)]
  // Buckets about as large as a cell, two sites to a bucket.
  const size = Math.sqrt((Math.max(...xs) - left) * (Math.max(...ys) - bottom) / sites.length * 2) || 1
  const bucketOf = ({x, y}: Point) => [Math.floor((x - left) / size), Math.floor((y - bottom) / size)] as const
  const buckets = Map.groupBy(sites, site => bucketOf(site).join())
  const reach = Math.ceil(Math.max(Math.max(...xs) - left, Math.max(...ys) - bottom) / size) + 1
  return sites.map(site => {
    const [column, row] = bucketOf(site)
    let cell = bounds
    for (let ring = 0; ring <= reach; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
            continue
          }
          for (const other of buckets.get(`${column + dx},${row + dy}`) ?? []) {
            if (other === site) {
              continue
            }
            const middle = point((site.x + other.x) / 2, (site.y + other.y) / 2)
            cell = halfPlane(cell, middle, point(other.x - site.x, other.y - site.y))
          }
        }
      }
      // Every site of the rings beyond lies at least this far from the site.
      if (ring * size > 2 * Math.max(...cell.map(corner => Math.hypot(corner.x - site.x, corner.y - site.y)))) {
        break
      }
    }
    return cell
  }).filter(cell => cell.length >= 3)
}

/** The middle of a polygon’s area. */
export function centroid(polygon: Polygon): Point {
  let [x, y, area] = [0, 0, 0]
  for (const [index, current] of polygon.entries()) {
    const next = polygon[(index + 1) % polygon.length]
    const cross = current.x * next.y - next.x * current.y
    area += cross
    x += (current.x + next.x) * cross
    y += (current.y + next.y) * cross
  }
  return point(x / (3 * area), y / (3 * area))
}

/** Moves every site to the middle of its cell `iterations` times, which evens the cells out (Lloyd’s relaxation). */
export function relax(sites: ReadonlyArray<Point>, bounds: Polygon, iterations: number): Array<Point> {
  let current = [...sites]
  for (let iteration = 0; iteration < iterations; iteration++) {
    current = voronoiCells(current, bounds).map(centroid)
  }
  return current
}
