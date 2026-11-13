import type {Wall} from '../placement/wallGeometry.ts'
import type {FloorPolygon} from './floorPolygons.ts'
import type {FloorRectangle} from './floors.ts'
import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {wallCoordinates} from '../placement/wallGeometry.ts'
import {wallFace} from './architectureDimensions.ts'
import {floorChunks, insidePolygon} from './floorPolygons.ts'
import lowerGallery, {tunnelDiagonalEast, tunnelDiagonalFloorY, tunnelDiagonalHeading, tunnelDiagonalPoint, tunnelDiagonalYaw} from './lowerGallery.ts'
import oculusBalcony from './oculusBalcony.ts'
import StairFlight, {stairThickness} from './stairs/StairFlight.ts'

type Point = readonly [number, number]

const {oculus, tunnel} = lowerGallery

export const tunnelDisplayWindow = {
  bottom: 0.55,
  top: 2.85,
  width: 13,
  glassThickness: 0.06,
}

/** Per-side placement along the diagonal gallery (`s` meters south-west of its north bend), keeping West south of Oculus and East north of Moonfall and its staff landing. */
const displayPlans = {
  west: {
    winNorthS: 2.85,
    northExtension: 1.15,
    upperCorner: [-13.5, -16.5525] as Point,
    upperSteps: 6,
    lowerSteps: 10,
  },
  east: {
    winNorthS: 1.5,
    northExtension: 0.7,
    upperCorner: [12.6, -16.5525] as Point,
    upperSteps: 3,
    lowerSteps: 16,
    lowerEnd: [-1.96, 3.2] as Point,
  },
} as const

export const displayNorthExtension = displayPlans.west.northExtension

const depth = 3.2
const thickness = 0.18
const ceilingThickness = 0.18

/**
 * Staff stairways run down behind both displays from doors in the Oculus’ side walls at the balcony’s ends.
 * Because Moonfall now opens in its own middle and the Exhibition runs diagonally between Oculus and Moonfall, the west and east stairways follow asymmetric routes.
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
    kind: 'box'
    name: string
    position: Vec3
    rotation: Vec3
    size: Vec3
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

const add = ([ax, az]: Point, [bx, bz]: Point, scale = 1): Point => [ax + scale * bx, az + scale * bz]
const dir = (a: Point, b: Point): Point => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length]
}
const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])
const rightOf = ([hx, hz]: Point): Point => [-hz, hx]
const yawOf = ([hx, hz]: Point) => Math.atan2(hx, hz)
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
  const shell: Array<DisplayBox> = [
    dispBox(centerS + thickness / 2, tunnelDiagonalFloorY(centerS + thickness / 2) - thickness / 2, centerAcross, [depth, thickness, length + thickness]),
    dispBox(centerS + thickness / 2, tunnelDiagonalFloorY(centerS + thickness / 2) + tunnel.height + thickness / 2, centerAcross, [depth, thickness, length + thickness]),
    dispBox(centerS + thickness / 2, tunnelDiagonalFloorY(centerS + thickness / 2) + tunnel.height / 2, backAcross + direction * thickness / 2, [thickness, tunnel.height, length + thickness]),
    dispBox(northS - thickness / 2, tunnelDiagonalFloorY(northS - thickness / 2) + tunnel.height / 2, centerAcross, [depth, tunnel.height, thickness]),
    dispBox(southS + thickness / 2, tunnelDiagonalFloorY(southS + thickness / 2) + tunnel.height / 2, southEndAcross, [southEndWidth, tunnel.height, thickness]),
  ]
  // Staff stairway from the Oculus balcony door down to the landing behind the display’s south end wall.
  const {headroom, going, rise, width: stairWidth} = displayStairway
  const halfW = stairWidth / 2
  const id = `${side}-display`
  const innerX = oculus.center[0] + direction * oculus.size[0] / 2
  const p0: Point = [innerX, doorZ]
  const p1 = plan.upperCorner
  const landingY = tunnelDiagonalFloorY(southS)
  let p3: Point
  let d3: Point
  if (side === 'west') {
    d3 = tunnelDiagonalEast
    p3 = tunnelDiagonalPoint(cutout.sOuter + halfW, backAcross - thickness)
  } else {
    d3 = [-1, 0]
    p3 = displayPlans.east.lowerEnd
  }
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
  const totalSteps = Math.floor((balconyY - landingY) / rise + 1e-9)
  const middleCount = totalSteps - plan.upperSteps - plan.lowerSteps - 3
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
  const corners: [DisplayLevel, DisplayLevel] = [
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
      segmentWall(`exhibition-stairs_${id.replaceAll('-', '_')}_landing_east`, wallNorthIn, wallSouthIn, landingY, landingHeadroom - 0.3, 1),
      segmentWall(`exhibition-stairs_${id.replaceAll('-', '_')}_landing_south`, landSouthOut, wallSouthIn, landingY, landingHeadroom - 0.3, -1),
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
      segmentWall(`exhibition-stairs_${id.replaceAll('-', '_')}_landing_north`, cutOuter, p3North, landingY, landingHeadroom - 0.3, 1),
      segmentWall(`exhibition-stairs_${id.replaceAll('-', '_')}_landing_south`, p3South, wallSouthIn, landingY, landingHeadroom - 0.3, 1),
      segmentWall(`exhibition-stairs_${id.replaceAll('-', '_')}_landing_west`, wallSouthIn, wallNorthIn, landingY, landingHeadroom - 0.3, 1),
    )
  }
  const landing: DisplayLevel = {
    polygon: landingPolygon,
    floor: landingY,
    headroom: landingHeadroom,
  }
  const stairWallName = (name: string) => `exhibition-stairs_${id.replaceAll('-', '_')}_${name.replaceAll('-', '_')}`
  const flightWall = (flight: StairFlight, cross: number): Wall => ({
    ...flight.wall(cross),
    trimStyle: 'plain',
  })
  // Close inside corners of both turns by wallFace * tan(|turn| / 2) so wall faces meet without a wedge gap.
  const insideReach1 = wallFace * Math.tan(Math.abs(c1.turn) / 2)
  const insideReach2 = wallFace * Math.tan(Math.abs(c2.turn) / 2)
  const upperBottom = flights[0].end[1] - stairThickness
  const upperWall = (cross: number): Wall => {
    const start = add(p0, rightOf(d1), cross * halfW)
    const end = add(c1.end1, rightOf(d1), cross * halfW)
    const wall = segmentWall(stairWallName(`upper-${cross < 0 ? 'left' : 'right'}`), start, end, upperBottom, balconyY + headroom - upperBottom - 0.3, cross < 0 ? 1 : -1)
    return cross === c1.inside ? extendWall(wall, cross < 0 ? 0 : insideReach1, cross < 0 ? insideReach1 : 0) : wall
  }
  const rampWall = (cross: number): Wall => {
    const start = add(c1.start2, rightOf(d2), cross * halfW)
    const end = add(midStart, rightOf(d2), cross * halfW)
    const wall = segmentWall(stairWallName(`ramp-${cross < 0 ? 'left' : 'right'}`), start, end, (corner1Y + rampEndY) / 2, headroom - 0.3, cross < 0 ? 1 : -1, rampSlope)
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
  const door: Vec3 = [innerX, balconyY, doorZ]
  const entryWall: Wall = {
    id: stairWallName('entry'),
    room: 'exhibition',
    center: [p0[0], balconyY, p0[1]],
    rotation: yawOf(d1),
    width: stairWidth,
    height: headroom - 0.3,
    sticky: false,
    trimStyle: 'plain',
  }
  // Outer walls of corner1 and corner2, always running from outer1 -> outerCorner -> outer2.
  const cornerWalls = [
    segmentWall(stairWallName('corner1-outer-a'), c1.outer1, c1.outerCorner, corner1Y, headroom - 0.3, c1.inside > 0 ? 1 : -1),
    segmentWall(stairWallName('corner1-outer-b'), c1.outerCorner, c1.outer2, corner1Y, headroom - 0.3, c1.inside > 0 ? 1 : -1),
    segmentWall(stairWallName('corner2-outer-a'), c2.outer1, c2.outerCorner, corner2Y, headroom - 0.3, c2.inside > 0 ? 1 : -1),
    segmentWall(stairWallName('corner2-outer-b'), c2.outerCorner, c2.outer2, corner2Y, headroom - 0.3, c2.inside > 0 ? 1 : -1),
  ]
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
    upperWall(-1),
    upperWall(1),
    rampWall(-1),
    rampWall(1),
    ...middleWalls,
    ...lowerWalls,
    ...cornerWalls,
    ...landingWalls,
  ]
  const boxSlab = (name: string, center: Point, heading: Point, width: number, runLength: number, top: number, height: number, slope = 0): StairSlab => {
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
  const polySlab = (name: string, poly: FloorPolygon, bottom: number, top: number): StairSlab => ({
    kind: 'polygon',
    name,
    polygon: poly,
    bottom,
    top,
  })
  const upperMid = add(p0, d1, upperLen / 2)
  const rampMid = add(c1.start2, d2, rampLen / 2)
  const slabs: Array<StairSlab> = [
    polySlab('display-stairway-floor', c1.polygon, corner1Y - oculusBalcony.size[1], corner1Y),
    polySlab('display-stairway-floor', c2.polygon, corner2Y - oculusBalcony.size[1], corner2Y),
    boxSlab('display-stairway-floor', rampMid, d2, stairWidth, rampLen, corner1Y, oculusBalcony.size[1], rampSlope),
    polySlab('display-landing-floor', landingPolygon, landingY - oculusBalcony.size[1], landingY),
    boxSlab('display-stairway-ceiling', upperMid, d1, stairWidth, upperLen, balconyY + headroom + ceilingThickness / 2, ceilingThickness),
    boxSlab('display-stairway-header', add(c1.end1, d1, thickness / 2), d1, stairWidth, thickness, balconyY + headroom + ceilingThickness / 2, balconyY - corner1Y),
    polySlab('display-stairway-ceiling', c1.polygon, corner1Y + headroom - ceilingThickness / 2, corner1Y + headroom + ceilingThickness / 2),
    boxSlab('display-stairway-ceiling', add(rampMid, d2, 0.05), d2, stairWidth, rampLen + 0.1, corner1Y + headroom + ceilingThickness / 2, ceilingThickness, rampSlope),
    polySlab('display-stairway-ceiling', c2.polygon, corner2Y + headroom - ceilingThickness / 2, corner2Y + headroom + ceilingThickness / 2),
    polySlab('display-landing-ceiling', landingPolygon, landingRoofTop - ceilingThickness, landingRoofTop),
    boxSlab('display-landing-header', add(p3, d3, -thickness / 2), d3, stairWidth, thickness, landingRoofTop, landingRoofTop - (flights[2].end[1] + headroom - ceilingThickness / 2)),
  ]
  const rampLampAlong = rampLen * 0.6
  const rampLampPt = add(c1.start2, d2, rampLampAlong)
  const lamps: Array<Vec3> = [
    [innerX + direction * (wallFace + 0.5), balconyY + headroom - ceilingThickness / 2, doorZ],
    [rampLampPt[0], corner1Y + rampLampAlong * rampSlope + headroom - ceilingThickness / 2, rampLampPt[1]],
    landingLamp,
  ]
  const polyAir = (poly: FloorPolygon, bottom: number, top: number, slack = 0.55): Array<DisplayAir> => floorChunks([poly], bottom, top - bottom, slack).map(({min, max}) => ({
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
  const air: Array<DisplayAir> = [
    ...flightAir(flights[0]),
    ...polyAir(c1.polygon, corner1Y, corner1Y + headroom),
    ...polyAir(rampPolygon, Math.min(corner1Y, rampEndY), Math.max(corner1Y, rampEndY) + headroom),
    ...flightAir(flights[1]),
    ...polyAir(c2.polygon, corner2Y, corner2Y + headroom),
    ...flightAir(flights[2]),
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
      waypoints: [p0, p1, p2, p3] as const,
      corners,
      ramp,
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
    for (const level of [...stairway.corners, stairway.ramp, stairway.landing] as ReadonlyArray<DisplayLevel>) {
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
