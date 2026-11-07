import type {FloorRectangle} from './floors.ts'

/** a convex area of a floor plan, its corners in order round it */
export type FloorPolygon = ReadonlyArray<Point>
/** a box around a stretch of air, from its floor to its ceiling */
export type FloorChunk = {
  max: readonly [number, number, number]
  min: readonly [number, number, number]
}
type Point = readonly [x: number, z: number]

const tolerance = 1e-6

/** The rectangle’s corners, round it from its north-west corner. */
export function rectanglePolygon({center: [x, z], size: [width, depth]}: FloorRectangle): FloorPolygon {
  return [[x - width / 2, z - depth / 2], [x + width / 2, z - depth / 2], [x + width / 2, z + depth / 2], [x - width / 2, z + depth / 2]]
}

/** The rectangle along x and z around the polygon. */
export function polygonBounds(polygon: FloorPolygon): FloorRectangle {
  const xs = polygon.map(([x]) => x)
  const zs = polygon.map(([, z]) => z)
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  return {
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    size: [maxX - minX, maxZ - minZ],
  }
}

export function polygonArea(polygon: FloorPolygon) {
  let twice = 0
  for (const [index, [x, z]] of polygon.entries()) {
    const [nextX, nextZ] = polygon[(index + 1) % polygon.length]
    twice += x * nextZ - nextX * z
  }
  return Math.abs(twice) / 2
}

/** The middle of the polygon’s area. */
export function polygonCentroid(polygon: FloorPolygon): Point {
  let twice = 0
  let x = 0
  let z = 0
  for (const [index, [ax, az]] of polygon.entries()) {
    const [bx, bz] = polygon[(index + 1) % polygon.length]
    const cross = ax * bz - bx * az
    twice += cross
    x += (ax + bx) * cross
    z += (az + bz) * cross
  }
  return [x / (3 * twice), z / (3 * twice)]
}

/** Whether the point lies on the convex polygon, its edges included. */
export function insidePolygon(polygon: FloorPolygon, x: number, z: number) {
  let sign = 0
  for (const [index, [ax, az]] of polygon.entries()) {
    const [bx, bz] = polygon[(index + 1) % polygon.length]
    const length = Math.hypot(bx - ax, bz - az)
    // how far the point lies to the left of the edge
    const side = ((bx - ax) * (z - az) - (bz - az) * (x - ax)) / length
    if (Math.abs(side) <= tolerance) {
      continue
    }
    if (sign && Math.sign(side) !== sign) {
      return false
    }
    sign = Math.sign(side)
  }
  return true
}

/** The part of the convex polygon where `nx · x + nz · z` stays at most `limit`, or nothing if barely any of it does. */
export function clipPolygon(polygon: FloorPolygon, [nx, nz]: Point, limit: number): FloorPolygon {
  const result: Array<Point> = []
  for (const [index, point] of polygon.entries()) {
    const next = polygon[(index + 1) % polygon.length]
    const here = point[0] * nx + point[1] * nz - limit
    const there = next[0] * nx + next[1] * nz - limit
    if (here <= 0) {
      result.push(point)
    }
    // Where the edge crosses the line, it gains a corner there.
    if (here * there >= 0) {
      continue
    }
    const share = here / (here - there)
    result.push([point[0] + (next[0] - point[0]) * share, point[1] + (next[1] - point[1]) * share])
  }
  return result.length >= 3 && polygonArea(result) > tolerance ? result : []
}

/** The polygon without the opening, in up to four convex pieces cut along the opening’s edges like `subtractFloorOpening` cuts a rectangle: the strips north and south of it first, then the pieces west and east of it in between. */
export function cutFloorOpening(polygon: FloorPolygon, opening?: FloorRectangle): Array<FloorPolygon> {
  if (!opening) {
    return [polygon]
  }
  const [x, z] = opening.center
  const [width, depth] = opening.size
  const [west, east, north, south] = [x - width / 2, x + width / 2, z - depth / 2, z + depth / 2]
  const between = clipPolygon(clipPolygon(polygon, [0, -1], -north), [0, 1], south)
  const inside = between.length ? clipPolygon(clipPolygon(between, [-1, 0], -west), [1, 0], east) : []
  if (!inside.length) {
    return [polygon]
  }
  return [clipPolygon(polygon, [0, 1], north), clipPolygon(polygon, [0, -1], -south), clipPolygon(between, [1, 0], west), clipPolygon(between, [-1, 0], -east)].filter(piece => piece.length)
}

/** The convex polygon in convex pieces of at most four corners, fanned out from the corner whose diagonals, the seams between the pieces, are shortest. */
export function quadrilaterals(polygon: FloorPolygon): Array<FloorPolygon> {
  const fan = (start: number) => {
    const corners = [...polygon.slice(start), ...polygon.slice(0, start)]
    const pieces: Array<FloorPolygon> = []
    for (let i = 1; i < corners.length - 1; i += 2) {
      pieces.push([corners[0], ...corners.slice(i, i + 3)])
    }
    return pieces
  }
  const seams = (pieces: Array<FloorPolygon>) => pieces.slice(1).reduce((sum, [[ax, az], [bx, bz]]) => sum + Math.hypot(bx - ax, bz - az), 0)
  return polygon.map((_, start) => fan(start)).reduce((best, pieces) => (seams(pieces) < seams(best) - tolerance ? pieces : best))
}

/**
 * The corners of convex hulls that together make a level slab over the polygon between two heights, one for each of its {@link quadrilaterals}.
 * Rapier builds the contacts of boxes and hulls against a hull’s face out of at most four of its corners, so a box sank 8.5 cm into one hull round the Lodge’s six-cornered floor.
 */
export function slabHulls(polygon: FloorPolygon, bottom: number, top: number) {
  return quadrilaterals(polygon).map(piece => new Float32Array(piece.flatMap(([x, z]) => [x, bottom, z, x, top, z])))
}

/**
 * Boxes around the air over the polygons from `bottom` up by `height`: one around each polygon whose edges all run along x or z, and around the others one for each of the strips across x they are cut into, so none reaches more than `slack` meters past the polygon’s askew edges.
 */
export function floorChunks(polygons: ReadonlyArray<FloorPolygon>, bottom: number, height: number, slack: number): Array<FloorChunk> {
  const box = (polygon: FloorPolygon): FloorChunk => {
    const {center: [x, z], size: [width, depth]} = polygonBounds(polygon)
    return {
      min: [x - width / 2, bottom, z - depth / 2],
      max: [x + width / 2, bottom + height, z + depth / 2],
    }
  }
  return polygons.flatMap(polygon => {
    // Within a strip as wide as w, the box around it stands w · sin a past an edge a radians askew of x.
    const askew = Math.max(0, ...polygon.map(([ax, az], index) => {
      const [bx, bz] = polygon[(index + 1) % polygon.length]
      const [dx, dz] = [Math.abs(bx - ax), Math.abs(bz - az)]
      return dx > tolerance && dz > tolerance ? dz / Math.hypot(dx, dz) : 0
    }))
    if (!askew) {
      return [box(polygon)]
    }
    const {center: [x], size: [width]} = polygonBounds(polygon)
    const count = Math.ceil(width * askew / slack)
    return Array.from({length: count}, (_, strip) => {
      const west = x - width / 2 + width * strip / count
      return clipPolygon(clipPolygon(polygon, [-1, 0], -west), [1, 0], west + width / count)
    }).filter(piece => piece.length).map(box)
  })
}
