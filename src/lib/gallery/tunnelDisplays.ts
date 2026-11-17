import type {Wall} from '../placement/wallGeometry.ts'
import type {FloorPolygon} from './floorPolygons.ts'
import type {FloorRectangle} from './floors.ts'
import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {wallCoordinates} from '../placement/wallGeometry.ts'
import {wallFace} from './architectureDimensions.ts'
import {floorChunks, insidePolygon} from './floorPolygons.ts'
import lowerGallery, {tunnelDiagonalEast, tunnelDiagonalFloorY, tunnelDiagonalHeading, tunnelDiagonalPoint, tunnelDiagonalYaw, tunnelSlope} from './lowerGallery.ts'
import oculusBalcony from './oculusBalcony.ts'
import StairBend from './stairs/StairBend.ts'
import StairFlight, {stairThickness} from './stairs/StairFlight.ts'

type Point = readonly [number, number]

const {oculus, tunnel} = lowerGallery

export const tunnelDisplayWindow = {
  bottom: 0.55,
  top: 2.85,
  width: 13,
  glassThickness: 0.06,
}

/** a stairway that turns at two sharp elbows, from the door out to `upperCorner`, back down a long ramp and into the lower flight */
type ElbowPlan = {
  lowerSteps: number
  northExtension: number
  route: 'elbows'
  upperCorner: Point
  upperSteps: number
  winNorthS: number
}
/**
 * A stairway that bows outward: from the door straight out into a quarter bend of `bendRadius`, down a short straight run and round a wider quarter bend back into the lower flight, which ends at `lowerEnd`.
 * The second bend is as much wider as the lower flight starts further back toward the door than the upper flight ends, so both bends meet the straight run between them tangentially.
 */
type BowPlan = {
  /** the radius of the first bend’s centerline, in meters */
  bendRadius: number
  /** how far the upper flight’s level stretch reaches from the door’s wall to its first step */
  entryLanding: number
  lowerEnd: Point
  lowerSteps: number
  northExtension: number
  route: 'bow'
  upperSteps: number
  winNorthS: number
}

/** Per-side placement along the diagonal gallery (`s` meters south-west of its north bend), keeping West south of Oculus and East north of Moonfall and its staff landing. */
const displayPlans = {
  west: {
    route: 'elbows',
    winNorthS: 2.85,
    northExtension: 1.15,
    upperCorner: [-13.5, -16.5525],
    upperSteps: 6,
    lowerSteps: 10,
  },
  // Nothing lies east of its stairway, which bows out into that space. The display’s south end lies due west of the lower flight’s end, which runs along Moonfall’s north wall: moving the display across the tunnel means moving it along the tunnel too, so that end only shifts along x.
  east: {
    route: 'bow',
    winNorthS: 1.34,
    northExtension: 0.7,
    entryLanding: 0.857,
    bendRadius: 5,
    upperSteps: 3,
    lowerSteps: 16,
    lowerEnd: [-1.62, 3.2],
  },
} as const satisfies {
  east: BowPlan
  west: ElbowPlan
}

export const displayNorthExtension = displayPlans.west.northExtension

const depth = 3.2
const thickness = 0.18
const ceilingThickness = 0.18
/** how far the facets of a bend’s walls may stand off their curve, in meters */
const bendTolerance = 0.004
/** how far the chords along the outside of the facets that hold a bend’s floor and air may stand off its curve, in meters: well within the outer wall’s face */
const bendFacetTolerance = 0.02

/**
 * Staff stairways run down behind both displays from doors in the Oculus’ side walls at the balcony’s ends.
 * Because Moonfall now opens in its own middle and the Exhibition runs diagonally between Oculus and Moonfall, the west and east stairways follow asymmetric routes: the west one round two elbows, the east one bowing out round two bends into the free space east of it.
 */
export const displayStairway = {
  width: 2.175,
  headroom: 2.8,
  going: 0.4,
  rise: 0.15,
  threshold: 0.4,
  doorWidth: 1.8,
  doorHeight: 2.1,
  cutoutWidth: 1.5,
}

const balconyY = oculusBalcony.position[1] + oculusBalcony.size[1] / 2
const balconyNorthZ = oculusBalcony.position[2] - oculusBalcony.size[2] / 2
/** where the doors sit along the Oculus side walls, halfway between the south wall’s face and the balcony’s edge */
const doorZ = (tunnel.northZ - wallFace + balconyNorthZ) / 2

export type DisplayBox = {
  position: Vec3
  rotation?: Vec3
  size: Vec3
}
export type StairSlab =
  | {
    bottom: number
    kind: 'polygon'
    name: string
    polygon: FloorPolygon
    top: number
  }
  | {
    bottom: number
    kind: 'swept'
    name: string
    /** the left and right edges of the slab, see `SweptSlabGeometry` */
    stations: ReadonlyArray<readonly [left: Point, right: Point]>
    top: number
  }
  | {
    kind: 'box'
    name: string
    position: Vec3
    rotation: Vec3
    size: Vec3
  }
/** a lamp under a stairway’s ceiling, by the name it goes by in the Exhibition’s lamps */
export type StairLamp = {
  name: string
  position: Vec3
}
type DisplayAir = FloorRectangle & Record<'bottom' | 'top', number>
type DisplayLevel = {
  floor: number
  headroom: number
  polygon: FloorPolygon
  /** start point, unit direction, length and vertical rise per meter along a sloped ramp level */
  ramp?: {
    direction: Point
    length: number
    slope: number
    start: Point
  }
}
/** what a route takes from its stairway: where it starts at the door, where its lower flight ends before the landing and how it names its walls */
type RouteEnds = {
  /** the door in the middle of the Oculus side wall, where the upper flight starts */
  door: Point
  /** which way the lower flight runs into its end */
  exit: Point
  /** where the lower flight ends, before the landing */
  foot: Point
  id: string
  landingY: number
  wallName: (name: string) => string
}
/** the part of a stairway between its door and its landing */
type StairRoute = {
  air: Array<DisplayAir>
  /** the heading from the door into the stairway */
  entry: Point
  /** the upper flight down from the door, the middle one between the turns and the lower one to the landing */
  flights: readonly [StairFlight, StairFlight, StairFlight]
  /** the lamps between the door’s and the landing’s */
  lamps: Array<StairLamp>
  /** the sloping stretch of floor between the turns, before the middle flight */
  ramp: DisplayLevel
  slabs: Array<StairSlab>
  /** the level floors where the route turns, as convex polygons: an elbow’s for each turn, or a bend’s facets */
  turns: Array<DisplayLevel>
  walls: Array<Wall>
  /** points along the route’s centerline from the door to the lower flight’s end, close enough to walk from one to the next in a straight line */
  waypoints: Array<Point>
}

const add = ([ax, az]: Point, [bx, bz]: Point, scale = 1): Point => [ax + scale * bx, az + scale * bz]
const dir = (a: Point, b: Point): Point => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length]
}
const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1]
const rightOf = ([hx, hz]: Point): Point => [-hz, hx]
const yawOf = ([hx, hz]: Point) => Math.atan2(hx, hz)
/** how the walls of a stairway name the side they stand on, left (`cross` −1) or right (1) of its way down */
const sideName = (cross: number) => (cross < 0 ? 'left' : 'right')
/** Convex elbow polygon where two runs of width `stairWidth` meet at `corner` turning from `d1` to `d2`. */
function elbowPolygon(corner: Point, d1: Point, d2: Point, halfW: number) {
  const turn = Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1])
  const elbow = halfW * Math.tan(Math.abs(turn) / 2)
  const inside = Math.sign(turn)
  const r1 = rightOf(d1)
  const r2 = rightOf(d2)
  const end1 = add(corner, d1, -elbow)
  const start2 = add(corner, d2, elbow)
  const inner = add(end1, r1, inside * halfW)
  const outer1 = add(end1, r1, -inside * halfW)
  const outer2 = add(start2, r2, -inside * halfW)
  const outerCorner = add(add(corner, d1, elbow), r1, -inside * halfW)
  return {
    turn,
    elbow,
    inside,
    end1,
    start2,
    inner,
    outer1,
    outer2,
    outerCorner,
    polygon: [inner, outer1, outerCorner, outer2] as FloorPolygon,
  }
}
/** Wall segment from `from` to `to` facing `inwardSide` × `rightOf(to - from)` (`1` = right-hand side of `from -> to`, `-1` = left-hand side). `slope` is vertical rise per meter along `from -> to`. */
function segmentWall(id: string, from: Point, to: Point, floorMidY: number, height: number, inwardSide: -1 | 1, slope = 0): Wall {
  const [dx, dz] = dir(from, to)
  const length = dist(from, to)
  const nx = -dz * inwardSide
  const nz = dx * inwardSide
  const rotation = Math.atan2(nx, nz)
  return {
    id,
    room: 'exhibition',
    center: [(from[0] + to[0]) / 2, floorMidY, (from[1] + to[1]) / 2],
    rotation,
    width: length,
    height,
    ...slope ? {slope: slope * (dx * Math.cos(rotation) - dz * Math.sin(rotation))} : {},
    sticky: false,
    trimStyle: 'plain',
  }
}
/** Extend a wall along its own endpoints (`startExtend` before `from`, `endExtend` past `to`) keeping its slope anchored at its floor. */
function extendWall(wall: Wall, startExtend: number, endExtend: number): Wall {
  const ux = Math.cos(wall.rotation)
  const uz = -Math.sin(wall.rotation)
  const shift = (endExtend - startExtend) / 2
  return {
    ...wall,
    center: [wall.center[0] + ux * shift, wall.center[1] + (wall.slope ?? 0) * shift, wall.center[2] + uz * shift],
    width: wall.width + startExtend + endExtend,
  }
}
/** A wall along one side of a flight, trimmed like the stairway’s others. */
const flightWall = (flight: StairFlight, cross: number): Wall => ({
  ...flight.wall(cross),
  trimStyle: 'plain',
})
/** A box from `top` at its start down by `height`, `runLength` long along `heading` from half that before `center` and `width` wide, sloping by `slope` per meter. */
function boxSlab(name: string, center: Point, heading: Point, width: number, runLength: number, top: number, height: number, slope = 0): StairSlab {
  const angle = Math.atan(slope)
  // Local +x aligns with heading when rotated around Y by atan2(-heading[1], heading[0]).
  const yaw = Math.atan2(-heading[1], heading[0])
  const forwardShift = height / 2 * Math.sin(angle)
  return {
    kind: 'box',
    name,
    position: [center[0] + heading[0] * forwardShift, top + slope * runLength / 2 - height / 2 * Math.cos(angle), center[1] + heading[1] * forwardShift],
    rotation: [0, yaw, angle],
    size: [Math.hypot(runLength, slope * runLength), height, width],
  }
}
const polySlab = (name: string, polygon: FloorPolygon, bottom: number, top: number): StairSlab => ({
  kind: 'polygon',
  name,
  polygon,
  bottom,
  top,
})
const polyAir = (polygon: FloorPolygon, bottom: number, top: number, slack = 0.55): Array<DisplayAir> => floorChunks([polygon], bottom, top - bottom, slack).map(({min, max}) => ({
  center: [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2],
  size: [max[0] - min[0], max[2] - min[2]],
  bottom: min[1],
  top: max[1],
}))
const flightAir = (flight: StairFlight): Array<DisplayAir> => flight.chunks(0.55).map(({min, max}) => ({
  center: [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2],
  size: [max[0] - min[0], max[2] - min[2]],
  bottom: min[1],
  top: max[1],
}))
/** How many steps lead from the balcony down to the landing, counting the step off every flight onto the floor below it; the ramp takes what is left over. */
const stepsDown = (landingY: number) => Math.floor((balconyY - landingY) / displayStairway.rise + 1e-9)
/** The route out from the door to `upperCorner`, back down a long ramp to a second elbow and into the lower flight, turning sharply at both elbows. */
function elbowRoute(plan: ElbowPlan, {door: p0, exit: d3, foot: p3, id, landingY, wallName}: RouteEnds): StairRoute {
  const {headroom, going, rise, width: stairWidth} = displayStairway
  const halfW = stairWidth / 2
  const p1 = plan.upperCorner
  // Place corner2 along p3 - t * d3 so the lower flight has an exact integer step count and zero landing overhang.
  let p2 = add(p3, d3, -(plan.lowerSteps * going + halfW))
  for (let i = 0; i < 12; i++) {
    const d2Try = dir(p1, p2)
    const turn2Try = Math.atan2(d2Try[0] * d3[1] - d2Try[1] * d3[0], d2Try[0] * d3[0] + d2Try[1] * d3[1])
    const elbow2Try = halfW * Math.tan(Math.abs(turn2Try) / 2)
    p2 = add(p3, d3, -(plan.lowerSteps * going + elbow2Try))
  }
  const d1 = dir(p0, p1)
  const d2 = dir(p1, p2)
  const c1 = elbowPolygon(p1, d1, d2, halfW)
  const c2 = elbowPolygon(p2, d2, d3, halfW)
  const upperLen = dist(p0, c1.end1)
  const entryLanding = upperLen - plan.upperSteps * going
  if (entryLanding < wallFace + displayStairway.threshold - 1e-6) {
    throw new RangeError(`${id}: upper entry landing ${entryLanding.toFixed(3)} m is shorter than required threshold.`)
  }
  const midLen = dist(c1.start2, c2.end1)
  const middleCount = stepsDown(landingY) - plan.upperSteps - plan.lowerSteps - 3
  if (middleCount < 1) {
    throw new RangeError(`${id}: middle flight needs at least one step.`)
  }
  const rampLen = midLen - middleCount * going
  const midStart = add(c1.start2, d2, rampLen)
  const corner1Y = balconyY - (plan.upperSteps + 1) * rise
  const corner2Y = landingY + (plan.lowerSteps + 1) * rise
  const rampEndY = corner2Y + (middleCount + 1) * rise
  const rampSlope = (rampEndY - corner1Y) / rampLen
  const flights = [
    new StairFlight(`${id}-upper`, [p0[0], balconyY, p0[1]], [c1.end1[0], corner1Y + rise, c1.end1[1]], stairWidth, plan.upperSteps, entryLanding, 0, 'exhibition', headroom),
    new StairFlight(`${id}-middle`, [midStart[0], rampEndY, midStart[1]], [c2.end1[0], corner2Y + rise, c2.end1[1]], stairWidth, middleCount, 0, 0, 'exhibition', headroom),
    new StairFlight(`${id}-lower`, [c2.start2[0], corner2Y, c2.start2[1]], [p3[0], landingY + rise, p3[1]], stairWidth, plan.lowerSteps, 0, 0, 'exhibition', headroom),
  ] as const
  const rampPolygon: FloorPolygon = [
    add(c1.start2, rightOf(d2), -halfW),
    add(midStart, rightOf(d2), -halfW),
    add(midStart, rightOf(d2), halfW),
    add(c1.start2, rightOf(d2), halfW),
  ]
  const turns: Array<DisplayLevel> = [
    {
      polygon: c1.polygon,
      floor: corner1Y,
      headroom,
    },
    {
      polygon: c2.polygon,
      floor: corner2Y,
      headroom,
    },
  ]
  const ramp: DisplayLevel = {
    polygon: rampPolygon,
    floor: corner1Y,
    headroom,
    ramp: {
      start: c1.start2,
      direction: d2,
      length: rampLen,
      slope: rampSlope,
    },
  }
  // Close inside corners of both turns by wallFace * tan(|turn| / 2) so wall faces meet without a wedge gap.
  const insideReach1 = wallFace * Math.tan(Math.abs(c1.turn) / 2)
  const insideReach2 = wallFace * Math.tan(Math.abs(c2.turn) / 2)
  const upperBottom = flights[0].end[1] - stairThickness
  const upperWall = (cross: number): Wall => {
    const start = add(p0, rightOf(d1), cross * halfW)
    const end = add(c1.end1, rightOf(d1), cross * halfW)
    const wall = segmentWall(wallName(`upper-${cross < 0 ? 'left' : 'right'}`), start, end, upperBottom, balconyY + headroom - upperBottom - 0.3, cross < 0 ? 1 : -1)
    return cross === c1.inside ? extendWall(wall, cross < 0 ? 0 : insideReach1, cross < 0 ? insideReach1 : 0) : wall
  }
  const rampWall = (cross: number): Wall => {
    const start = add(c1.start2, rightOf(d2), cross * halfW)
    const end = add(midStart, rightOf(d2), cross * halfW)
    const wall = segmentWall(wallName(`ramp-${cross < 0 ? 'left' : 'right'}`), start, end, (corner1Y + rampEndY) / 2, headroom - 0.3, cross < 0 ? 1 : -1, rampSlope)
    return cross === c1.inside ? extendWall(wall, cross < 0 ? insideReach1 : 0, cross < 0 ? 0 : insideReach1) : wall
  }
  const middleWalls = [-1, 1].map(cross => {
    const wall = flightWall(flights[1], cross)
    if (cross === c2.inside) {
      return extendWall(wall, cross < 0 ? 0 : insideReach2, cross < 0 ? insideReach2 : 0)
    }
    return wall
  })
  const lowerWalls = [-1, 1].map(cross => {
    const wall = flightWall(flights[2], cross)
    if (cross === c2.inside) {
      return extendWall(wall, cross < 0 ? insideReach2 : 0, cross < 0 ? 0 : insideReach2)
    }
    return wall
  })
  // Outer walls of corner1 and corner2, always running from outer1 -> outerCorner -> outer2.
  const cornerWalls = [
    segmentWall(wallName('corner1-outer-a'), c1.outer1, c1.outerCorner, corner1Y, headroom - 0.3, c1.inside > 0 ? 1 : -1),
    segmentWall(wallName('corner1-outer-b'), c1.outerCorner, c1.outer2, corner1Y, headroom - 0.3, c1.inside > 0 ? 1 : -1),
    segmentWall(wallName('corner2-outer-a'), c2.outer1, c2.outerCorner, corner2Y, headroom - 0.3, c2.inside > 0 ? 1 : -1),
    segmentWall(wallName('corner2-outer-b'), c2.outerCorner, c2.outer2, corner2Y, headroom - 0.3, c2.inside > 0 ? 1 : -1),
  ]
  const upperMid = add(p0, d1, upperLen / 2)
  const rampMid = add(c1.start2, d2, rampLen / 2)
  const rampLampAlong = rampLen * 0.6
  const rampLampPt = add(c1.start2, d2, rampLampAlong)
  return {
    entry: d1,
    flights,
    turns,
    ramp,
    walls: [upperWall(-1), upperWall(1), rampWall(-1), rampWall(1), ...middleWalls, ...lowerWalls, ...cornerWalls],
    slabs: [
      polySlab('display-stairway-floor', c1.polygon, corner1Y - oculusBalcony.size[1], corner1Y),
      polySlab('display-stairway-floor', c2.polygon, corner2Y - oculusBalcony.size[1], corner2Y),
      boxSlab('display-stairway-floor', rampMid, d2, stairWidth, rampLen, corner1Y, oculusBalcony.size[1], rampSlope),
      boxSlab('display-stairway-ceiling', upperMid, d1, stairWidth, upperLen, balconyY + headroom + ceilingThickness / 2, ceilingThickness),
      boxSlab('display-stairway-header', add(c1.end1, d1, thickness / 2), d1, stairWidth, thickness, balconyY + headroom + ceilingThickness / 2, balconyY - corner1Y),
      polySlab('display-stairway-ceiling', c1.polygon, corner1Y + headroom - ceilingThickness / 2, corner1Y + headroom + ceilingThickness / 2),
      boxSlab('display-stairway-ceiling', add(rampMid, d2, 0.05), d2, stairWidth, rampLen + 0.1, corner1Y + headroom + ceilingThickness / 2, ceilingThickness, rampSlope),
      polySlab('display-stairway-ceiling', c2.polygon, corner2Y + headroom - ceilingThickness / 2, corner2Y + headroom + ceilingThickness / 2),
    ],
    lamps: [
      {
        name: 'ramp',
        position: [rampLampPt[0], corner1Y + rampLampAlong * rampSlope + headroom - ceilingThickness / 2, rampLampPt[1]],
      },
    ],
    air: [
      ...flightAir(flights[0]),
      ...polyAir(c1.polygon, corner1Y, corner1Y + headroom),
      ...polyAir(rampPolygon, Math.min(corner1Y, rampEndY), Math.max(corner1Y, rampEndY) + headroom),
      ...flightAir(flights[1]),
      ...polyAir(c2.polygon, corner2Y, corner2Y + headroom),
      ...flightAir(flights[2]),
    ],
    waypoints: [p0, p1, p2, p3],
  }
}
/**
 * The route straight out from the door, round a quarter bend to the right, down a short straight run with the ramp and the middle flight, and round a wider quarter bend back into the lower flight, so that it bows outward instead of cutting back in at sharp elbows.
 * Both bends are level and meet the runs before and after them tangentially, their walls curving along them.
 */
function bowRoute(plan: BowPlan, direction: number, {door: p0, exit: d3, foot: p3, id, landingY, wallName}: RouteEnds): StairRoute {
  const {headroom, going, rise, width: stairWidth} = displayStairway
  const halfW = stairWidth / 2
  const d1: Point = [direction, 0]
  const d2 = rightOf(d1)
  if (dist(d3, [-d1[0], -d1[1]]) > 1e-9) {
    throw new RangeError(`${id}: a bowed stairway has to turn back the way it came out of the door.`)
  }
  if (plan.entryLanding < wallFace + displayStairway.threshold - 1e-6) {
    throw new RangeError(`${id}: upper entry landing ${plan.entryLanding.toFixed(3)} m is shorter than required threshold.`)
  }
  const upperLen = plan.entryLanding + plan.upperSteps * going
  // where the upper flight ends and the lower one starts
  const top = add(p0, d1, upperLen)
  const foot = add(p3, d3, -plan.lowerSteps * going)
  const upperRadius = plan.bendRadius
  // The lower flight starts further back toward the door than the upper one ends, which its bend makes up for with a wider radius.
  const lowerRadius = upperRadius - dot([foot[0] - top[0], foot[1] - top[1]], d1)
  const straight = dot([foot[0] - top[0], foot[1] - top[1]], d2) - upperRadius - lowerRadius
  const middleCount = stepsDown(landingY) - plan.upperSteps - plan.lowerSteps - 3
  if (middleCount < 1) {
    throw new RangeError(`${id}: middle flight needs at least one step.`)
  }
  const rampLen = straight - middleCount * going
  if (!(rampLen > 0.5)) {
    throw new RangeError(`${id}: the straight run between the bends is ${straight.toFixed(3)} m, too short for its ramp and its middle flight.`)
  }
  if (Math.min(upperRadius, lowerRadius) - halfW < 1) {
    throw new RangeError(`${id}: the bends need at least a meter of radius inside their inner walls.`)
  }
  const corner1Y = balconyY - (plan.upperSteps + 1) * rise
  const corner2Y = landingY + (plan.lowerSteps + 1) * rise
  const rampEndY = corner2Y + (middleCount + 1) * rise
  const rampSlope = (rampEndY - corner1Y) / rampLen
  const upperBend = new StairBend(top, d1, upperRadius, Math.PI / 2, stairWidth, corner1Y)
  // The straight run, from exact sums along the axes so its flight keeps to one.
  const rampStart = add(add(top, d1, upperRadius), d2, upperRadius)
  const midStart = add(rampStart, d2, rampLen)
  const midEnd = add(rampStart, d2, straight)
  const lowerBend = new StairBend(midEnd, d2, lowerRadius, Math.PI / 2, stairWidth, corner2Y)
  if (dist(lowerBend.end, foot) > 1e-9) {
    throw new RangeError(`${id}: the lower bend misses the lower flight.`)
  }
  const flights = [
    new StairFlight(`${id}-upper`, [p0[0], balconyY, p0[1]], [top[0], corner1Y + rise, top[1]], stairWidth, plan.upperSteps, plan.entryLanding, 0, 'exhibition', headroom),
    new StairFlight(`${id}-middle`, [midStart[0], rampEndY, midStart[1]], [midEnd[0], corner2Y + rise, midEnd[1]], stairWidth, middleCount, 0, 0, 'exhibition', headroom),
    new StairFlight(`${id}-lower`, [foot[0], corner2Y, foot[1]], [p3[0], landingY + rise, p3[1]], stairWidth, plan.lowerSteps, 0, 0, 'exhibition', headroom),
  ] as const
  const rampPolygon: FloorPolygon = [
    add(rampStart, rightOf(d2), -halfW),
    add(midStart, rightOf(d2), -halfW),
    add(midStart, rightOf(d2), halfW),
    add(rampStart, rightOf(d2), halfW),
  ]
  const bends = [upperBend, lowerBend] as const
  const bendFacets = bends.map(bend => bend.facets(bend.facetCount(bendFacetTolerance)))
  const turns = bends.flatMap((bend, index) => bendFacets[index].map((polygon): DisplayLevel => ({
    polygon,
    floor: bend.floor,
    headroom,
  })))
  const ramp: DisplayLevel = {
    polygon: rampPolygon,
    floor: corner1Y,
    headroom,
    ramp: {
      start: rampStart,
      direction: d2,
      length: rampLen,
      slope: rampSlope,
    },
  }
  const upperBottom = flights[0].end[1] - stairThickness
  const sides = [-1, 1] as const
  const upperWalls = sides.map(cross => segmentWall(wallName(`upper-${sideName(cross)}`), add(p0, rightOf(d1), cross * halfW), add(top, rightOf(d1), cross * halfW), upperBottom, balconyY + headroom - upperBottom - 0.3, cross < 0 ? 1 : -1))
  const bendWalls = bends.flatMap((bend, index) => sides.map(cross => bend.wall(cross, {
    id: wallName(`${index ? 'lower' : 'upper'}-bend-${sideName(cross)}`),
    room: 'exhibition',
    height: headroom - 0.3,
    curveTolerance: bendTolerance,
    trimStyle: 'plain',
  })))
  const rampWalls = sides.map(cross => segmentWall(wallName(`ramp-${sideName(cross)}`), add(rampStart, rightOf(d2), cross * halfW), add(midStart, rightOf(d2), cross * halfW), (corner1Y + rampEndY) / 2, headroom - 0.3, cross < 0 ? 1 : -1, rampSlope))
  // the bend’s floor and ceiling, swept along the same facets as its walls’ outer one
  const bendSlab = (bend: StairBend, name: string, bottom: number, slabTop: number): StairSlab => ({
    kind: 'swept',
    name,
    stations: bend.stations(Math.max(...sides.map(cross => bend.wallFacets(cross, bendTolerance)))),
    bottom,
    top: slabTop,
  })
  const upperMid = add(p0, d1, upperLen / 2)
  const rampMid = add(rampStart, d2, rampLen / 2)
  const [bendX, bendZ] = lowerBend.point(0.5)
  return {
    entry: d1,
    flights,
    turns,
    ramp,
    walls: [...upperWalls, ...bendWalls, ...rampWalls, ...flights.slice(1).flatMap(flight => sides.map(cross => flightWall(flight, cross)))],
    slabs: [
      ...bends.map(bend => bendSlab(bend, 'display-stairway-floor', bend.floor - oculusBalcony.size[1], bend.floor)),
      boxSlab('display-stairway-floor', rampMid, d2, stairWidth, rampLen, corner1Y, oculusBalcony.size[1], rampSlope),
      boxSlab('display-stairway-ceiling', upperMid, d1, stairWidth, upperLen, balconyY + headroom + ceilingThickness / 2, ceilingThickness),
      boxSlab('display-stairway-header', add(top, d1, thickness / 2), d1, stairWidth, thickness, balconyY + headroom + ceilingThickness / 2, balconyY - corner1Y),
      ...bends.map(bend => bendSlab(bend, 'display-stairway-ceiling', bend.floor + headroom - ceilingThickness / 2, bend.floor + headroom + ceilingThickness / 2)),
      // Into the middle flight’s roof, like the elbows’ ramp.
      boxSlab('display-stairway-ceiling', add(rampMid, d2, 0.05), d2, stairWidth, rampLen + 0.1, corner1Y + headroom + ceilingThickness / 2, ceilingThickness, rampSlope),
    ],
    lamps: [
      {
        name: 'ramp',
        position: [rampMid[0], corner1Y + rampLen / 2 * rampSlope + headroom - ceilingThickness / 2, rampMid[1]],
      },
      {
        name: 'bend',
        position: [bendX, corner2Y + headroom - ceilingThickness / 2, bendZ],
      },
    ],
    air: [
      ...flightAir(flights[0]),
      ...bendFacets[0].flatMap(polygon => polyAir(polygon, corner1Y, corner1Y + headroom)),
      ...polyAir(rampPolygon, Math.min(corner1Y, rampEndY), Math.max(corner1Y, rampEndY) + headroom),
      ...flightAir(flights[1]),
      ...bendFacets[1].flatMap(polygon => polyAir(polygon, corner2Y, corner2Y + headroom)),
      ...flightAir(flights[2]),
    ],
    waypoints: [
      p0,
      top,
      ...[1, 2, 3].map(k => upperBend.point(k / 4)),
      rampStart,
      midEnd,
      ...[1, 2, 3, 4, 5].map(k => lowerBend.point(k / 6)),
      foot,
      p3,
    ],
  }
}
const tunnelDisplays = (['west', 'east'] as const).map(side => {
  const direction = side === 'west' ? -1 : 1
  const plan = displayPlans[side]
  const winNorthS = plan.winNorthS
  const winSouthS = winNorthS + tunnelDisplayWindow.width
  const winCenterS = (winNorthS + winSouthS) / 2
  const northS = winNorthS - plan.northExtension
  const southS = winSouthS
  const centerS = (northS + southS) / 2
  const length = southS - northS
  const frontAcross = direction * tunnel.width / 2
  const backAcross = frontAcross + direction * depth
  const centerAcross = (frontAcross + backAcross) / 2
  const [frontX, frontZ] = tunnelDiagonalPoint(winCenterS, frontAcross)
  const [backX, backZ] = tunnelDiagonalPoint(winCenterS, backAcross)
  const [centerX, centerZ] = tunnelDiagonalPoint(centerS, centerAcross)
  const [northMidX, northMidZ] = tunnelDiagonalPoint(northS, centerAcross)
  const polygon: FloorPolygon = [
    tunnelDiagonalPoint(northS, frontAcross),
    tunnelDiagonalPoint(southS, frontAcross),
    tunnelDiagonalPoint(southS, backAcross),
    tunnelDiagonalPoint(northS, backAcross),
  ]
  const cutout = {
    fromAcross: backAcross - direction * displayStairway.cutoutWidth,
    toAcross: backAcross,
    top: tunnelDiagonalFloorY(southS + thickness) + tunnel.height,
    sInner: southS,
    sOuter: southS + thickness,
  }
  // Display room shell in world space, rotated along the diagonal gallery.
  const dispBox = (s: number, y: number, across: number, size: Vec3): DisplayBox => {
    const [wx, wz] = tunnelDiagonalPoint(s, across)
    return {
      position: [wx, y, wz],
      rotation: [0, tunnelDiagonalYaw, 0],
      size,
    }
  }
  const southEndAcross = (frontAcross + cutout.fromAcross) / 2
  const southEndWidth = Math.abs(cutout.fromAcross - frontAcross)
  // The shell’s sheared boxes share one floor plane, extrapolated past the tunnel’s level stubs where the north end wall reaches beyond the slope.
  const shellFloorY = (s: number) => tunnelDiagonalFloorY(centerS) + (s - centerS) * tunnelSlope
  // The back and north walls reach through the floor and ceiling slabs and the north wall past the back wall, so no seam is a bare edge the sky could show through.
  const shell: Array<DisplayBox> = [
    dispBox(centerS + thickness / 2, shellFloorY(centerS + thickness / 2) - thickness / 2, centerAcross, [depth, thickness, length + thickness]),
    dispBox(centerS + thickness / 2, shellFloorY(centerS + thickness / 2) + tunnel.height + thickness / 2, centerAcross, [depth, thickness, length + thickness]),
    dispBox(centerS + thickness / 2, shellFloorY(centerS + thickness / 2) + tunnel.height / 2, backAcross + direction * thickness / 2, [thickness, tunnel.height + 2 * thickness, length + thickness]),
    dispBox(northS - thickness / 2, shellFloorY(northS - thickness / 2) + tunnel.height / 2, centerAcross + direction * thickness / 2, [depth + thickness, tunnel.height + 2 * thickness, thickness]),
    dispBox(southS + thickness / 2, shellFloorY(southS + thickness / 2) + tunnel.height / 2, southEndAcross, [southEndWidth, tunnel.height, thickness]),
  ]
  // Staff stairway from the Oculus balcony door down to the landing behind the display’s south end wall.
  const {headroom, width: stairWidth} = displayStairway
  const halfW = stairWidth / 2
  const id = `${side}-display`
  const stairWallName = (name: string) => `exhibition-stairs_${id.replaceAll('-', '_')}_${name.replaceAll('-', '_')}`
  const innerX = oculus.center[0] + direction * oculus.size[0] / 2
  const p0: Point = [innerX, doorZ]
  const landingY = tunnelDiagonalFloorY(southS)
  const p3: Point = side === 'west' ? tunnelDiagonalPoint(cutout.sOuter + halfW, backAcross - thickness) : displayPlans.east.lowerEnd
  const d3: Point = side === 'west' ? tunnelDiagonalEast : [-1, 0]
  const ends: RouteEnds = {
    id,
    door: p0,
    exit: d3,
    foot: p3,
    landingY,
    wallName: stairWallName,
  }
  const route = plan.route === 'elbows' ? elbowRoute(plan, ends) : bowRoute(plan, direction, ends)
  const {flights} = route
  // Landing polygon behind the south end wall’s cutout.
  const landingHeadroom = cutout.top + ceilingThickness / 2 - landingY
  const cutInner = tunnelDiagonalPoint(cutout.sOuter, cutout.fromAcross)
  const cutOuter = tunnelDiagonalPoint(cutout.sOuter, cutout.toAcross)
  const landingInnerAcross = cutout.fromAcross - direction * wallFace
  const landingWalls: Array<Wall> = []
  let landingPolygon: FloorPolygon
  let landingLamp: Vec3
  const landingRoofTop = landingY + landingHeadroom + ceilingThickness / 2
  if (side === 'west') {
    const sNorth = cutout.sOuter
    const sSouth = cutout.sOuter + stairWidth
    const landNorthOut = tunnelDiagonalPoint(sNorth, cutout.toAcross - thickness)
    const landSouthOut = tunnelDiagonalPoint(sSouth, cutout.toAcross - thickness)
    const landSouthIn = tunnelDiagonalPoint(sSouth, cutout.fromAcross)
    landingPolygon = [cutInner, landNorthOut, landSouthOut, landSouthIn]
    const wallNorthIn = tunnelDiagonalPoint(sNorth, landingInnerAcross)
    const wallSouthIn = tunnelDiagonalPoint(sSouth, landingInnerAcross)
    const [lampX, lampZ] = tunnelDiagonalPoint((sNorth + sSouth) / 2, (cutout.fromAcross + cutout.toAcross - thickness) / 2)
    landingLamp = [lampX, landingY + landingHeadroom - ceilingThickness / 2, lampZ]
    landingWalls.push(
      segmentWall(stairWallName('landing-east'), wallNorthIn, wallSouthIn, landingY, landingHeadroom - 0.3, 1),
      segmentWall(stairWallName('landing-south'), landSouthOut, wallSouthIn, landingY, landingHeadroom - 0.3, -1),
    )
  } else {
    const p3North: Point = [p3[0], p3[1] - halfW]
    const p3South: Point = [p3[0], p3[1] + halfW]
    const landSouthIn = tunnelDiagonalPoint(cutout.sOuter + stairWidth, cutout.fromAcross)
    landingPolygon = [cutInner, cutOuter, p3North, p3South, landSouthIn]
    const wallNorthIn = tunnelDiagonalPoint(cutout.sOuter, landingInnerAcross)
    const wallSouthIn = tunnelDiagonalPoint(cutout.sOuter + stairWidth, landingInnerAcross)
    const cx = (cutInner[0] + cutOuter[0] + p3North[0] + p3South[0] + landSouthIn[0]) / 5
    const cz = (cutInner[1] + cutOuter[1] + p3North[1] + p3South[1] + landSouthIn[1]) / 5
    landingLamp = [cx, landingY + landingHeadroom - ceilingThickness / 2, cz]
    landingWalls.push(
      segmentWall(stairWallName('landing-north'), cutOuter, p3North, landingY, landingHeadroom - 0.3, 1),
      segmentWall(stairWallName('landing-south'), p3South, wallSouthIn, landingY, landingHeadroom - 0.3, 1),
      segmentWall(stairWallName('landing-west'), wallSouthIn, wallNorthIn, landingY, landingHeadroom - 0.3, 1),
    )
  }
  const landing: DisplayLevel = {
    polygon: landingPolygon,
    floor: landingY,
    headroom: landingHeadroom,
  }
  const door: Vec3 = [innerX, balconyY, doorZ]
  const entryWall: Wall = {
    id: stairWallName('entry'),
    room: 'exhibition',
    center: [p0[0], balconyY, p0[1]],
    rotation: yawOf(route.entry),
    width: stairWidth,
    height: headroom - 0.3,
    sticky: false,
    trimStyle: 'plain',
  }
  const walls: Array<Wall> = [
    {
      ...entryWall,
      holes: [
        {
          u: wallCoordinates(entryWall, door),
          width: displayStairway.doorWidth,
          height: displayStairway.doorHeight,
          profile: 'rectangle',
        },
      ],
    },
    ...route.walls,
    ...landingWalls,
  ]
  const slabs: Array<StairSlab> = [
    ...route.slabs,
    polySlab('display-landing-floor', landingPolygon, landingY - oculusBalcony.size[1], landingY),
    polySlab('display-landing-ceiling', landingPolygon, landingRoofTop - ceilingThickness, landingRoofTop),
    boxSlab('display-landing-header', add(p3, d3, -thickness / 2), d3, stairWidth, thickness, landingRoofTop, landingRoofTop - (flights[2].end[1] + headroom - ceilingThickness / 2)),
  ]
  const lamps: Array<StairLamp> = [
    {
      name: 'door',
      position: [innerX + direction * (wallFace + 0.5), balconyY + headroom - ceilingThickness / 2, doorZ],
    },
    ...route.lamps,
    {
      name: 'landing',
      position: landingLamp,
    },
  ]
  const air: Array<DisplayAir> = [
    ...route.air,
    ...polyAir(landingPolygon, landingY, landingY + landingHeadroom),
    ...polyAir(polygon, tunnelDiagonalFloorY(northS), tunnelDiagonalFloorY(southS) + tunnel.height, 0.25),
    ...polyAir([
      tunnelDiagonalPoint(cutout.sInner, cutout.fromAcross),
      tunnelDiagonalPoint(cutout.sOuter, cutout.fromAcross),
      tunnelDiagonalPoint(cutout.sOuter, cutout.toAcross),
      tunnelDiagonalPoint(cutout.sInner, cutout.toAcross),
    ], landingY, cutout.top),
  ]
  // Three empty exhibit pedestals along the display’s back wall, inside the uniform-slope diagonal stretch.
  const exhibitSs = side === 'west' ? [winCenterS - 4.75, winCenterS - 0.3, winCenterS + 4.15] : [winCenterS - 4.35, winCenterS - 0.1, winCenterS + 4.15]
  return {
    side,
    direction,
    northS,
    southS,
    winNorthS,
    winSouthS,
    winCenterS,
    frontAcross,
    backAcross,
    frontX,
    frontZ,
    backX,
    backZ,
    center: [centerX, centerZ] as const,
    northCenter: [northMidX, northMidZ] as const,
    size: [depth, length] as const,
    polygon,
    shell,
    exhibits: exhibitSs.map((s, i) => {
      const [ex, ez] = tunnelDiagonalPoint(s, centerAcross)
      return {
        id: `tunnel-${side}-exhibit-${i}`,
        s,
        position: [ex, tunnelDiagonalFloorY(s) + (tunnelDisplayWindow.bottom + tunnelDisplayWindow.top) / 2, ez] as Vec3,
      }
    }),
    stairway: {
      id,
      door,
      cutout,
      waypoints: route.waypoints,
      turns: route.turns,
      ramp: route.ramp,
      landing,
      flights,
      treads: flights.flatMap(flight => flight.blocks),
      walls,
      slabs,
      roofs: flights.slice(1).map(flight => flight.beam(headroom, ceilingThickness, flight.width)) satisfies Array<StairBeam>,
      lamps,
      air,
    },
  }
})

/** The floor elevation under `(x, z)` in either display or on its staff stairway, or undefined elsewhere. */
export function displayFloorHeight(x: number, z: number) {
  return displayGround(x, z)?.floor
}

/** Whether the position lies in a display or on its stairway down from the Oculus balcony. */
export function insideTunnelDisplay([x, y, z]: Vec3) {
  const ground = displayGround(x, z)
  return ground !== undefined && y >= ground.floor - 1 && y <= ground.floor + ground.headroom
}

function displayGround(x: number, z: number) {
  for (const display of tunnelDisplays) {
    const {stairway} = display
    const flightFloor = stairway.flights.map(flight => flight.floorAt(x, z)).find(floor => floor !== undefined)
    if (flightFloor !== undefined) {
      return {
        floor: flightFloor,
        headroom: displayStairway.headroom,
      }
    }
    for (const level of [...stairway.turns, stairway.ramp, stairway.landing] as ReadonlyArray<DisplayLevel>) {
      if (!insidePolygon(level.polygon, x, z)) {
        continue
      }
      if (level.ramp) {
        const along = (x - level.ramp.start[0]) * level.ramp.direction[0] + (z - level.ramp.start[1]) * level.ramp.direction[1]
        return {
          floor: level.floor + Math.min(Math.max(along, 0), level.ramp.length) * level.ramp.slope,
          headroom: level.headroom,
        }
      }
      return {
        floor: level.floor,
        headroom: level.headroom,
      }
    }
    const cutoutThroat: FloorPolygon = [
      tunnelDiagonalPoint(stairway.cutout.sInner, stairway.cutout.fromAcross),
      tunnelDiagonalPoint(stairway.cutout.sOuter, stairway.cutout.fromAcross),
      tunnelDiagonalPoint(stairway.cutout.sOuter, stairway.cutout.toAcross),
      tunnelDiagonalPoint(stairway.cutout.sInner, stairway.cutout.toAcross),
    ]
    if (insidePolygon(display.polygon, x, z) || insidePolygon(cutoutThroat, x, z)) {
      const s = x * tunnelDiagonalHeading[0] + (z - lowerGallery.tunnel.northBendZ) * tunnelDiagonalHeading[1]
      return {
        floor: tunnelDiagonalFloorY(s),
        headroom: tunnel.height,
      }
    }
  }
}

export default tunnelDisplays
export {polygonBounds} from './floorPolygons.ts'
