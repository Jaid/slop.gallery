import type {OrnamentPoint, PlanePoint} from '../lib/ornaments.ts'

import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import {ornament} from '../lib/frameGeometry.ts'
import {sheet} from '../lib/ornaments.ts'

/** a stone’s girdle, its outline as seen from the front, about 1 across its half width: the point at the share `s` of the way round, counterclockwise from +x */
export type Girdle = (s: number) => PlanePoint
/** a stone’s half width and half height in meters, which its girdle is scaled to */
export type StoneSize = readonly [x: number, y: number]

/** how far out the table of a brilliant lies, as a share of the way to its girdle */
const brilliantTable = 0.56
/** how far up its crown the points of a brilliant’s stars lie, as a share of its height */
const starHeight = 0.56

/** a round girdle */
export const roundGirdle: Girdle = s => [Math.cos(s * Math.PI * 2), Math.sin(s * Math.PI * 2)]
/** a cushion: a square with its sides bowed out and its corners rounded off, a superellipse */
export const cushionGirdle: Girdle = s => {
  const [x, y] = roundGirdle(s)
  return [Math.sign(x) * Math.abs(x) ** (2 / 3), Math.sign(y) * Math.abs(y) ** (2 / 3)]
}
/** An octagon, a square with its corners cut off `corner` of its half width deep, which a stone’s size stretches into the oblong of an emerald cut, its corners every eighth of the way round, the first at the bottom of its right side. */
export function octagonGirdle(corner: number): Girdle {
  const corners: Array<PlanePoint> = [[1, corner - 1], [1, 1 - corner], [1 - corner, 1], [corner - 1, 1], [-1, 1 - corner], [-1, corner - 1], [corner - 1, -1], [1 - corner, -1]]
  return s => {
    const at = (s % 1 + 1) % 1 * 8
    const index = Math.floor(at)
    const [ax, ay] = corners[index]
    const [bx, by] = corners[(index + 1) % 8]
    return [ax + (bx - ax) * (at - index), ay + (by - ay) * (at - index)]
  }
}

/** A point of the girdle scaled to the stone’s size, `scale` of the way out from its middle, `z` meters over its girdle. */
const onGirdle = (girdle: Girdle, [x, y]: StoneSize, s: number, scale: number, z: number): OrnamentPoint => {
  const [gx, gy] = girdle(s)
  return [gx * x * scale, gy * y * scale, z]
}
/** how a collet’s rim rises into claws gripping its stone’s crown: how many, how much higher than the rim their tips stand, and how far in over the crown they reach */
export type Claws = {
  count: number
  height: number
  reach: number
}

/**
 * The crown of a brilliant over its girdle, `height` meters high: an eight-sided table, or `mains`-sided, a star facet on each of its edges, kite-shaped bezels between the stars down to the girdle, and two upper girdle facets under every star. Its pavilion lies hidden in its collet.
 */
export function brilliantCrown(girdle: Girdle, size: StoneSize, height: number, {kind = 0, mains = 8}: {
  kind?: number
  mains?: number
} = {}) {
  const table = Array.from({length: mains}, (_, index) => onGirdle(girdle, size, index / mains, brilliantTable, height))
  const stars = Array.from({length: mains}, (_, index) => onGirdle(girdle, size, (index + 0.5) / mains, (1 + brilliantTable) / 2, height * starHeight))
  const rim = Array.from({length: mains * 2}, (_, index) => onGirdle(girdle, size, index / (mains * 2), 1, 0))
  const triangles: Array<readonly [OrnamentPoint, OrnamentPoint, OrnamentPoint]> = []
  for (let index = 1; index < mains - 1; index++) {
    triangles.push([table[0], table[index], table[index + 1]])
  }
  for (let index = 0; index < mains; index++) {
    const next = (index + 1) % mains
    const before = (index + mains - 1) % mains
    triangles.push(
      [table[index], stars[index], table[next]],
      // The bezel: a kite from the table’s corner between two stars down to the girdle.
      [table[index], stars[before], rim[index * 2]],
      [table[index], rim[index * 2], stars[index]],
      [stars[index], rim[index * 2], rim[index * 2 + 1]],
      [stars[index], rim[index * 2 + 1], rim[(index * 2 + 2) % (mains * 2)]],
    )
  }
  return facets(triangles, size, kind)
}

/**
 * The crown of a step-cut stone over its octagonal girdle, `height` meters high: bands of long facets parallel to its sides stepping up from the girdle to a broad table, `steps` of them, each as far up as it is in.
 */
export function stepCrown(girdle: Girdle, size: StoneSize, height: number, {kind = 0, steps = 2}: {
  kind?: number
  steps?: number
} = {}) {
  const table = 0.62
  // The corners of each ring at every eighth of the way round, the girdle first, the table last; the lower steps steeper than the upper ones.
  const rings = Array.from({length: steps + 1}, (_, ring) => {
    const share = ring / steps
    const scale = 1 - (1 - table) * share
    return Array.from({length: 8}, (__, corner) => onGirdle(girdle, size, corner / 8, scale, height * Math.sin(share * Math.PI / 2)))
  })
  const triangles: Array<readonly [OrnamentPoint, OrnamentPoint, OrnamentPoint]> = []
  for (let ring = 0; ring < steps; ring++) {
    for (let corner = 0; corner < 8; corner++) {
      const next = (corner + 1) % 8
      const [lower, upper] = [rings[ring], rings[ring + 1]]
      triangles.push([lower[corner], lower[next], upper[next]], [lower[corner], upper[next], upper[corner]])
    }
  }
  const top = rings.at(-1)!
  for (let corner = 1; corner < 7; corner++) {
    triangles.push([top[0], top[corner], top[corner + 1]])
  }
  return facets(triangles, size, kind)
}

/**
 * A collet: a band of gold raised round a stone’s girdle, its foot sunk 2 mm into what it rests on, its rim burnished over the girdle, which lies `girdleZ` meters over its foot, `wall` meters thick, closing round the stone in `pieces`, with a rounded crest between its wall and its lip or, `plain`, a flat rim; `claws` raise its rim into claws gripping the crown. Its `uv` run once round it and across it from its foot, over its rim, to its lip.
 */
export function collet(girdle: Girdle, size: StoneSize, {claws, girdleZ, kind = 0, pieces, plain = false, wall}: {
  claws?: Claws
  girdleZ: number
  kind?: number
  pieces: number
  plain?: boolean
  wall: number
}) {
  // Out from the girdle and up from its plane: foot, wall, the crest of the rim, and the lip lying over the girdle.
  const profile = plain ? [[wall + 0.0003, -girdleZ - 0.002], [wall, 0.0006], [-0.0006, 0.0007]] as const : [[wall + 0.0003, -girdleZ - 0.002], [wall, 0.0003], [wall * 0.45, 0.0009], [-0.0006, 0.0006]] as const
  const lip = profile.length - 1
  return sheet(pieces, lip, (column, row) => {
    const s = column / pieces
    const [x, y] = onGirdle(girdle, size, s, 1, 0)
    const [ax, ay] = onGirdle(girdle, size, s - 0.002, 1, 0)
    const [bx, by] = onGirdle(girdle, size, s + 0.002, 1, 0)
    const length = Math.hypot(bx - ax, by - ay)
    // The outline runs counterclockwise, so out is to the right of its way round.
    const [nx, ny] = [(by - ay) / length, -(bx - ax) / length]
    const claw = claws ? Math.max(0, Math.cos(s * claws.count * Math.PI * 2)) ** 6 : 0
    const [out, up] = profile[row]
    const lift = row >= lip - 1 && row > 1 ? claw * (claws?.height ?? 0) * (row === lip ? 1 : 0.8) : 0
    const inward = row === lip ? claw * (claws?.reach ?? 0) : 0
    return [x + nx * (out - inward), y + ny * (out - inward), girdleZ + up + lift]
  }, {
    kind,
    wrap: true,
  })
}

/**
 * The crown of a cut stone from its facets, each a flat triangle, all facing the viewer, as an ornament of the `kind` given. Its `uv` are where each point lies across the stone, from −1 to 1 along both of its sides, for the stone’s material to find its way through it.
 */
function facets(triangles: ReadonlyArray<readonly [OrnamentPoint, OrnamentPoint, OrnamentPoint]>, [x, y]: StoneSize, kind: number) {
  const position: Array<number> = []
  const uv: Array<number> = []
  for (const triangle of triangles) {
    const [a, b, c] = triangle
    const turn = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    for (const point of turn >= 0 ? [a, b, c] : [a, c, b]) {
      position.push(...point)
      uv.push(point[0] / x, point[1] / y)
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  // Unindexed, every facet keeps its own flat normal.
  geometry.computeVertexNormals()
  return ornament(geometry, {
    kind,
    ownUv: true,
  })
}

/** How many triangles the crown of a brilliant with `mains` sides to its table takes. */
export const brilliantTriangles = (mains: number) => mains * 6 - 2
/** How many triangles the crown of a step-cut stone with `steps` steps takes. */
export const stepTriangles = (steps: number) => steps * 16 + 6
/** How many triangles a collet closing round its stone in `pieces` takes, a `plain` one or one with a crest. */
export const colletTriangles = (pieces: number, plain = false) => pieces * (plain ? 4 : 6)
/** How many triangles a pearl in `segments` round and `rings` up takes. */
export const pearlTriangles = (segments: number, rings: number) => segments * (rings * 2 - 1)

/** A pearl of `radius` meters, its lower part sunk into what it rests on, in `segments` round and `rings` from where it sinks in, round its equator, which gives its outline, up to its crown, which closes in a fan; its normals are a sphere’s own. */
export function pearl(radius: number, segments: number, rings: number, kind = 0) {
  const sunk = -0.9
  const middle = radius * 0.62
  const position: Array<number> = []
  const normal: Array<number> = []
  // A ring of points at every height but the crown, which is a single point.
  for (let ring = 0; ring <= rings; ring++) {
    const latitude = ring === 0 ? sunk : (ring - 1) / (rings - 1) * Math.PI / 2
    for (let segment = 0; segment < (ring === rings ? 1 : segments); segment++) {
      const longitude = segment / segments * Math.PI * 2
      const direction = ring === rings ? [0, 0, 1] : [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)]
      position.push(direction[0] * radius, direction[1] * radius, middle + direction[2] * radius)
      normal.push(...direction)
    }
  }
  const index: Array<number> = []
  const vertex = (ring: number, segment: number) => ring * segments + segment % segments
  for (let ring = 0; ring < rings - 1; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      index.push(vertex(ring, segment), vertex(ring, segment + 1), vertex(ring + 1, segment + 1), vertex(ring, segment), vertex(ring + 1, segment + 1), vertex(ring + 1, segment))
    }
  }
  const crown = rings * segments
  for (let segment = 0; segment < segments; segment++) {
    index.push(vertex(rings - 1, segment), vertex(rings - 1, segment + 1), crown)
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setIndex(index)
  return ornament(geometry, {kind})
}
