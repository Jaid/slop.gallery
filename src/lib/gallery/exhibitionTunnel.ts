import type {Wall, WallOpening} from '../placement/wallGeometry.ts'
import type {FloorChunk, FloorPolygon} from './floorPolygons.ts'
import type {Vec3} from './types.ts'

import {wallFace} from './architectureDimensions.ts'
import {floorChunks, insidePolygon} from './floorPolygons.ts'
import lowerGallery from './lowerGallery.ts'

/** a side of the tunnel, seen walking down its diagonal from the Oculus toward Moonfall: the west one lies to the right */
export type TunnelSide = 'east' | 'west'
type Point = readonly [number, number]
type Range = readonly [number, number]

const {tunnel} = lowerGallery
const half = tunnel.width / 2
const [northX, northZ] = tunnel.north
const [southX, southZ] = tunnel.south
/** where the straight run out of the Oculus’ south wall turns onto the diagonal */
const bendNorth: Point = [northX, northZ + tunnel.straight]
/** where the diagonal turns into the straight run into Moonfall’s north wall */
const bendSouth: Point = [southX, southZ - tunnel.straight]
const length = Math.hypot(bendSouth[0] - bendNorth[0], bendSouth[1] - bendNorth[1])
/** the unit direction down the diagonal, from the Oculus toward Moonfall */
const along: Point = [(bendSouth[0] - bendNorth[0]) / length, (bendSouth[1] - bendNorth[1]) / length]
/** the unit direction across the diagonal toward its east side */
const across: Point = [along[1], -along[0]]
/** the turn around y that turns +z into the diagonal’s direction and +x into its direction across, toward its east side */
const yaw = Math.atan2(along[0], along[1])
/** how far the turns at both ends of the diagonal bend off the straight runs, which both run along +z */
const turn = Math.acos(Math.min(1, along[1]))
/** how far the open elbow at either end of the diagonal reaches into it and into the straight run, from the point where they meet, see Passage */
const elbow = half * Math.tan(turn / 2)
if (!(along[1] > 0) || !(length - 2 * elbow > 1) || tunnel.straight <= elbow) {
  throw new RangeError('The Exhibition’s tunnel needs a diagonal running south between straight runs longer than its elbows.')
}
const tolerance = 1e-9

/** The point of the diagonal’s frame `x` meters across toward its east side and `z` meters down from where it starts, in the museum’s meters. */
export function frameToWorld([x, z]: Point): Point {
  return [bendNorth[0] + along[0] * z + across[0] * x, bendNorth[1] + along[1] * z + across[1] * x]
}

/** The point in the museum’s meters as `x` meters across the diagonal’s frame toward its east side and `z` meters down it from where it starts. */
export function worldToFrame([x, z]: Point): [number, number] {
  const dx = x - bendNorth[0]
  const dz = z - bendNorth[1]
  return [dx * across[0] + dz * across[1], dx * along[0] + dz * along[1]]
}

/**
 * The frame the diagonal of the Exhibition’s tunnel lays out its displays and their stairways in: its origin where the straight run out of the Oculus turns onto the diagonal, its +z down the diagonal toward Moonfall and its +x across it toward its east side, turned by `yaw` around y.
 * The diagonal’s floor slopes evenly along z between its elbows, and is level in the elbows and the straight runs at both ends.
 */
export const tunnelFrame = {
  origin: bendNorth,
  yaw,
  /** from where the diagonal starts to where it ends, along its center line */
  length,
  /** how far into the diagonal the elbow at either end reaches, where its slope starts and ends */
  elbow,
  /** how far the turns at its ends bend off the straight runs, in radians */
  turn,
  half,
} as const

/** how much the diagonal’s floor rises per meter down it, between its elbows */
export const tunnelSlope = (tunnel.southY - tunnel.northY) / (length - 2 * elbow)

/** The height of the slope of the tunnel’s floor `z` meters down its diagonal’s frame, carried on past its elbows, as the displays behind its walls slope along with it. */
export function tunnelSlopeHeight(z: number) {
  return tunnel.northY + (z - elbow) * tunnelSlope
}

/** The height of the tunnel’s floor `z` meters down its diagonal’s frame: level in the elbows and beyond, sloping evenly between them. */
export function tunnelFloorHeight(z: number) {
  if (z <= elbow) {
    return tunnel.northY
  }
  return z >= length - elbow ? tunnel.southY : tunnelSlopeHeight(z)
}

/** the middle of the diagonal’s sloping floor, halfway between the tunnel’s ends, which the Exhibition is laid out around */
export const tunnelCenter: Vec3 = (() => {
  const [x, z] = frameToWorld([0, length / 2])
  return [x, tunnelFloorHeight(length / 2), z]
})()

/** where the lines through the points along the directions meet */
function meet(a: Point, da: Point, b: Point, db: Point): Point {
  const denominator = da[0] * db[1] - da[1] * db[0]
  const share = ((b[0] - a[0]) * db[1] - (b[1] - a[1]) * db[0]) / denominator
  return [a[0] + da[0] * share, a[1] + da[1] * share]
}
const same = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6
/** The polygon without the corners that repeat the one before them. */
const distinct = (polygon: ReadonlyArray<Point>): FloorPolygon => polygon.filter((point, index) => !same(point, polygon[(index + polygon.length - 1) % polygon.length]))
const sides = {
  west: -1,
  east: 1,
} as const satisfies Record<TunnelSide, -1 | 1>
/** Per side, its line along the diagonal, the corners where the straight runs meet it and where its slope starts and ends on it, in the museum’s meters. */
const outline = Object.fromEntries(Object.entries(sides).map(([side, sign]) => {
  const runX = sign * half
  const corner = (bend: Point) => meet([bend[0] + runX, bend[1]], [0, 1], frameToWorld([runX, 0]), along)
  return [side, {
    /** where the straight run out of the Oculus’ wall leaves it */
    start: [northX + runX, northZ] as Point,
    /** where the straight run out of the Oculus meets the diagonal */
    north: corner(bendNorth),
    /** where the diagonal’s slope starts and ends */
    slopeStart: frameToWorld([runX, elbow]),
    slopeEnd: frameToWorld([runX, length - elbow]),
    /** where the diagonal meets the straight run into Moonfall */
    south: corner(bendSouth),
    /** where the straight run into Moonfall’s wall meets it */
    end: [southX + runX, southZ] as Point,
  }]
})) as Record<TunnelSide, Record<'end' | 'north' | 'slopeEnd' | 'slopeStart' | 'south' | 'start', Point>>
const {east, west} = outline

/** Per side, how far down the diagonal’s frame its walls turn from the straight runs at both ends onto the diagonal: in the elbow inside a turn, before it outside one. */
export const tunnelCorners = Object.fromEntries(Object.entries(outline).map(([side, {north, south}]) => [side, {
  north: worldToFrame(north)[1],
  south: worldToFrame(south)[1],
}])) as Record<TunnelSide, Record<'north' | 'south', number>>

/**
 * The tunnel’s floor, in pieces in the museum’s meters: the level one from the Oculus’ wall through the elbow onto the diagonal, the sloping one along the diagonal between its elbows and the level one from there into Moonfall’s wall.
 * The sloping one is a rectangle along the diagonal’s frame, between its elbows.
 */
export const tunnelFloors = {
  north: distinct([west.start, east.start, east.north, east.slopeStart, west.slopeStart, west.north]),
  slope: [west.slopeStart, east.slopeStart, east.slopeEnd, west.slopeEnd] as FloorPolygon,
  south: distinct([west.slopeEnd, east.slopeEnd, east.south, east.end, west.end, west.south]),
} as const

/** how thick the slabs under the tunnel’s floor and over its ceiling are */
const floorDepth = 0.24
const ceilingDepth = 0.18
/**
 * The slabs under the tunnel’s floor and over its ceiling: level ones over the level pieces of its floor at both ends, in the museum’s meters, and sloping ones along the diagonal between its elbows, plumb at both ends, in the diagonal’s frame.
 * The sloping ones rise by `slope` per meter along the frame’s z; their `position` is their middle.
 */
export const tunnelSlabs = {
  level: ([[tunnelFloors.north, tunnel.northY], [tunnelFloors.south, tunnel.southY]] as const).flatMap(([polygon, y]) => [
    {
      name: 'exhibition-floor',
      polygon,
      bottom: y - floorDepth,
      top: y,
    },
    {
      name: 'exhibition-ceiling',
      polygon,
      bottom: y + tunnel.height,
      top: y + tunnel.height + ceilingDepth,
    },
  ]),
  sloped: [
    {
      name: 'exhibition-floor',
      position: [0, tunnelFloorHeight(length / 2) - floorDepth / 2, length / 2] as Vec3,
      size: [tunnel.width, floorDepth, length - 2 * elbow] as Vec3,
    },
    {
      name: 'exhibition-ceiling',
      position: [0, tunnelFloorHeight(length / 2) + tunnel.height + ceilingDepth / 2, length / 2] as Vec3,
      size: [tunnel.width, ceilingDepth, length - 2 * elbow] as Vec3,
    },
  ],
  slope: tunnelSlope,
} as const

/** The floor of the tunnel under the point in the museum’s meters, or undefined off it. */
export function tunnelFloorAt(x: number, z: number) {
  if (insidePolygon(tunnelFloors.north, x, z)) {
    return tunnel.northY
  }
  if (insidePolygon(tunnelFloors.south, x, z)) {
    return tunnel.southY
  }
  const [frameX, frameZ] = worldToFrame([x, z])
  if (Math.abs(frameX) <= half + tolerance && frameZ >= elbow - tolerance && frameZ <= length - elbow + tolerance) {
    return tunnelFloorHeight(frameZ)
  }
}

/** Whether the position lies in the tunnel, from a meter under its floor up to its ceiling. */
export function insideTunnel([x, y, z]: Vec3) {
  const floor = tunnelFloorAt(x, z)
  return floor !== undefined && y >= floor - 1 && y <= floor + tunnel.height
}

/** Boxes around the tunnel’s air, from its floor to its ceiling, none reaching more than `slack` meters past its askew walls. */
export function tunnelChunks(slack: number): Array<FloorChunk> {
  return [
    ...floorChunks([tunnelFloors.north], tunnel.northY, tunnel.height, slack),
    ...floorChunks([tunnelFloors.slope], tunnel.northY, tunnel.height, slack).map(({min, max}) => {
      // Each strip only spans the stretch of the slope it lies over.
      const zs = [[min[0], min[2]], [max[0], min[2]], [max[0], max[2]], [min[0], max[2]]].map(([x, z]) => worldToFrame([x, z])[1])
      return {
        min: [min[0], tunnelFloorHeight(Math.min(...zs)), min[2]] as const,
        max: [max[0], tunnelFloorHeight(Math.max(...zs)) + tunnel.height, max[2]] as const,
      }
    }),
    ...floorChunks([tunnelFloors.south], tunnel.southY, tunnel.height, slack),
  ]
}

/**
 * A wall standing on the floor along the line from `from` to `to` in the museum’s meters, facing toward `inward`, its floor at `fromY` at the line’s start and at `toY` at its end, its face `height` meters over it, as {@link Wall} takes one.
 * `extend` runs it on past its start and its end by those many meters, along its slope.
 */
export function lineWall(id: string, room: string, from: Point, to: Point, inward: Point, fromY: number, toY: number, height: number, extend: Range = [0, 0]): Wall {
  const rotation = Math.atan2(inward[0], inward[1])
  // The wall’s own +x, along which its slope rises.
  const ownX: Point = [Math.cos(rotation), -Math.sin(rotation)]
  const width = Math.hypot(to[0] - from[0], to[1] - from[1])
  const direction: Point = [(to[0] - from[0]) / width, (to[1] - from[1]) / width]
  const rise = (toY - fromY) / width
  const start: Point = [from[0] - direction[0] * extend[0], from[1] - direction[1] * extend[0]]
  const end: Point = [to[0] + direction[0] * extend[1], to[1] + direction[1] * extend[1]]
  const startY = fromY - rise * extend[0]
  const endY = toY + rise * extend[1]
  const forward = direction[0] * ownX[0] + direction[1] * ownX[1] > 0 ? 1 : -1
  return {
    id,
    room,
    center: [(start[0] + end[0]) / 2, (startY + endY) / 2, (start[1] + end[1]) / 2],
    rotation,
    width: width + extend[0] + extend[1],
    height,
    ...rise ? {slope: rise * forward} : {},
    sticky: false,
    trimStyle: 'plain',
  }
}

/** how far a wall runs on past the corner inside a turn, where it meets the next wall’s back, closing the wedge between their ends, see Passage */
const reach = wallFace * Math.tan(turn / 2)
/** a window in a side wall of the diagonal, between the two points down the diagonal’s frame */
export type TunnelWindow = Omit<WallOpening, 'u' | 'width'> & {range: Range}

/**
 * The tunnel’s walls in the museum’s meters, on each side from the Oculus’ wall to Moonfall’s: along the straight run out of the Oculus, along the diagonal and along the straight run into Moonfall, the diagonal’s rising with its floor between its elbows.
 * Outside a turn, the diagonal’s wall runs level through the elbow, as the floor does, before it starts rising, and meets the straight run’s in a corner; inside the turn, both run on behind each other’s ends.
 * The rising wall of each side carries its display’s window, if `windows` gives it one.
 */
export function tunnelWalls(windows: Partial<Record<TunnelSide, TunnelWindow>> = {}): Array<Wall> {
  return (['west', 'east'] as const).flatMap(side => {
    const sign = sides[side]
    const {start, north, slopeStart, slopeEnd, south, end} = outline[side]
    const inwardRun: Point = [-sign, 0]
    const inwardDiagonal: Point = [-sign * across[0], -sign * across[1]]
    const id = (name: string) => `exhibition-${side}${name ? `_${name}` : ''}`
    // Inside a turn, the corner lies where the slope starts or ends.
    const insideNorth = same(north, slopeStart)
    const insideSouth = same(south, slopeEnd)
    const height = tunnel.height
    const rising = lineWall(id(''), 'exhibition', slopeStart, slopeEnd, inwardDiagonal, tunnel.northY, tunnel.southY, height, [insideNorth ? reach : 0, insideSouth ? reach : 0])
    const window = windows[side]
    if (window) {
      const {range, ...opening} = window
      const [from, to] = range.map(z => frameToWorld([sign * half, z]))
      // along the wall’s own x from its middle
      const u = (point: Point) => (point[0] - rising.center[0]) * Math.cos(rising.rotation) - (point[1] - rising.center[2]) * Math.sin(rising.rotation)
      rising.holes = [{
        ...opening,
        u: (u(from) + u(to)) / 2,
        width: Math.abs(range[1] - range[0]),
      }]
    }
    return [
      lineWall(id('oculus'), 'exhibition', start, north, inwardRun, tunnel.northY, tunnel.northY, height, [0, insideNorth ? reach : 0]),
      ...insideNorth ? [] : [lineWall(id('oculus_bend'), 'exhibition', north, slopeStart, inwardDiagonal, tunnel.northY, tunnel.northY, height)],
      rising,
      ...insideSouth ? [] : [lineWall(id('moonfall_bend'), 'exhibition', slopeEnd, south, inwardDiagonal, tunnel.southY, tunnel.southY, height)],
      lineWall(id('moonfall'), 'exhibition', south, end, inwardRun, tunnel.southY, tunnel.southY, height, [insideSouth ? reach : 0, 0]),
    ]
  })
}
