import type {Wall} from '../placement/wallGeometry.ts'
import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {antechamberMoonfallDoor} from './antechamber.ts'
import CurvedBoxGeometry from './CurvedBoxGeometry.ts'
import {floorThickness} from './floors.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'
import StairHandrailGeometry from './stairs/StairHandrailGeometry.ts'
import StairTurn from './stairs/StairTurn.ts'

const moonfallEastX = lowerGallery.moonfall.center[0] + lowerGallery.moonfall.size[0] / 2
const staircase = {
  // The upper flight begins at Moonfall’s east wall so no descending tread or sidewall dips over Moonfall’s raised ceiling.
  startX: moonfallEastX,
  turnX: moonfallEastX + 10,
  endX: moonfallEastX,
  // Runs east south of the lower flight, then swings north around the U-turn to arrive dead-center on Moonfall’s east wall.
  z: lowerGallery.moonfall.center[1] + 6.5,
  returnZ: lowerGallery.moonfall.center[1],
  width: antechamberMoonfallDoor.width,
  lowerWidth: 5,
  topY: 0,
  bottomY: lowerGallery.floorY,
  landing: 0.8,
  count: 44,
} as const
/**
 * The level curved gallery at ground elevation (y = 0, slab bottom −0.24 m flush with Moonfall’s raised ceiling) linking the south doorway of the Antechamber’s west pavilion to the head of Moonfall’s upper descending flight east of Moonfall’s footprint.
 */
const approachRadius = 5.5
const approachBendCenter = [antechamberMoonfallDoor.x + approachRadius, staircase.z - approachRadius] as const
const approachHalfWidth = staircase.width / 2

export const stairApproach = {
  width: staircase.width,
  height: stairHeadroom,
  y: staircase.topY,
  entry: [antechamberMoonfallDoor.x, antechamberMoonfallDoor.z] as const,
  bendCenter: approachBendCenter,
  radius: approachRadius,
  innerRadius: approachRadius - approachHalfWidth,
  outerRadius: approachRadius + approachHalfWidth,
  southRun: {
    x: antechamberMoonfallDoor.x,
    z1: antechamberMoonfallDoor.z,
    z2: approachBendCenter[1],
  },
  eastRun: {
    z: staircase.z,
    x1: approachBendCenter[0],
    x2: staircase.startX,
  },
} as const

/** Point along the approach’s 90° bend; angle 0 leaves the south run at its west end, π / 2 enters the east run at its south end. */
export function approachBendPoint(angle: number, radius: number = stairApproach.radius): [number, number] {
  const [cx, cz] = stairApproach.bendCenter
  return [cx - Math.cos(angle) * radius, cz + Math.sin(angle) * radius]
}

/** Whether world `(x, z)` lies inside the curved level approach to Moonfall’s stairs. */
export function insideApproachPlan(x: number, z: number): boolean {
  const tol = 1e-9
  const {southRun, eastRun, bendCenter: [cx, cz], innerRadius, outerRadius} = stairApproach
  if (Math.abs(x - southRun.x) <= approachHalfWidth + tol && z >= southRun.z1 - tol && z <= southRun.z2 + tol) {
    return true
  }
  if (Math.abs(z - eastRun.z) <= approachHalfWidth + tol && x >= eastRun.x1 - tol && x <= eastRun.x2 + tol) {
    return true
  }
  if (x <= cx + tol && z >= cz - tol) {
    const r = Math.hypot(x - cx, z - cz)
    return r >= innerRadius - tol && r <= outerRadius + tol
  }
  return false
}

export function approachBendFloorGeometry() {
  return approachBendSlab(floorThickness, stairApproach.y - floorThickness / 2)
}

export function approachBendCeilingGeometry() {
  return approachBendSlab(0.18, stairApproach.y + stairHeadroom + 0.09)
}

/** Quarter-ring floor or ceiling slab geometry for the curved approach bend. */
function approachBendSlab(thickness: number, y: number) {
  const {bendCenter: [cx, cz], radius, width} = stairApproach
  const geometry = new CurvedBoxGeometry(Math.PI / 2 * radius, thickness, width, radius)
  return geometry
    .translate(0, 0, -radius)
    .rotateY(3 * Math.PI / 4)
    .translate(cx, y, cz)
}

/** Straight floor and ceiling slabs of the curved approach’s south and east runs. */
export const approachSlabs = [
  {
    name: 'south',
    center: [stairApproach.southRun.x, (stairApproach.southRun.z1 + stairApproach.southRun.z2) / 2] as const,
    size: [stairApproach.width, stairApproach.southRun.z2 - stairApproach.southRun.z1] as const,
  },
  {
    name: 'east',
    center: [(stairApproach.eastRun.x1 + stairApproach.eastRun.x2) / 2, stairApproach.eastRun.z] as const,
    size: [stairApproach.eastRun.x2 - stairApproach.eastRun.x1, stairApproach.width] as const,
  },
] as const

/** World walls along the curved level approach (south run, 90° bend and east run). */
export function approachWalls(): Array<Wall> {
  const {southRun, eastRun, bendCenter: [cx, cz], innerRadius, outerRadius, y} = stairApproach
  const height = stairHeadroom - 0.3
  const southLen = southRun.z2 - southRun.z1
  const southMidZ = (southRun.z1 + southRun.z2) / 2
  const eastLen = eastRun.x2 - eastRun.x1
  const eastMidX = (eastRun.x1 + eastRun.x2) / 2
  return [
    {
      id: 'moonfall-stairs_approach_west',
      room: 'moonfall',
      center: [southRun.x - approachHalfWidth, y, southMidZ],
      rotation: Math.PI / 2,
      width: southLen,
      height,
      sticky: false,
    },
    {
      id: 'moonfall-stairs_approach_east',
      room: 'moonfall',
      center: [southRun.x + approachHalfWidth, y, southMidZ],
      rotation: -Math.PI / 2,
      width: southLen,
      height,
      sticky: false,
    },
    {
      id: 'moonfall-stairs_approach_bend_outer',
      room: 'moonfall',
      center: [cx - outerRadius * Math.SQRT1_2, y, cz + outerRadius * Math.SQRT1_2],
      rotation: 3 * Math.PI / 4,
      curveRadius: outerRadius,
      width: Math.PI / 2 * outerRadius,
      height,
      sticky: false,
    },
    {
      id: 'moonfall-stairs_approach_bend_inner',
      room: 'moonfall',
      center: [cx - innerRadius * Math.SQRT1_2, y, cz + innerRadius * Math.SQRT1_2],
      rotation: -Math.PI / 4,
      curveRadius: -innerRadius,
      width: Math.PI / 2 * innerRadius,
      height,
      sticky: false,
    },
    {
      id: 'moonfall-stairs_approach_north',
      room: 'moonfall',
      center: [eastMidX, y, eastRun.z - approachHalfWidth],
      rotation: 0,
      width: eastLen,
      height,
      sticky: false,
    },
    {
      id: 'moonfall-stairs_approach_south',
      room: 'moonfall',
      center: [eastMidX, y, eastRun.z + approachHalfWidth],
      rotation: Math.PI,
      width: eastLen,
      height,
      sticky: false,
    },
  ]
}

/** Disjoint axis-aligned world footprints covering the curved level approach above Moonfall’s ceiling. */
export const approachFootprints = [
  {
    x: stairApproach.southRun.x - approachHalfWidth,
    z: stairApproach.southRun.z1,
    x2: stairApproach.southRun.x + approachHalfWidth,
    z2: stairApproach.southRun.z2,
  },
  {
    x: stairApproach.bendCenter[0] - stairApproach.outerRadius,
    z: stairApproach.bendCenter[1],
    x2: stairApproach.bendCenter[0],
    z2: stairApproach.bendCenter[1] + stairApproach.outerRadius,
  },
  {
    x: stairApproach.eastRun.x1,
    z: stairApproach.eastRun.z - approachHalfWidth,
    x2: stairApproach.eastRun.x2,
    z2: stairApproach.eastRun.z + approachHalfWidth,
  },
] as const

export const stairFlights = [
  new StairFlight('upper', [staircase.startX, staircase.topY, staircase.z], [staircase.turnX, staircase.bottomY / 2, staircase.z], staircase.width, staircase.count / 2, staircase.landing),
  new StairFlight('lower', [staircase.turnX, staircase.bottomY / 2, staircase.returnZ], [staircase.endX, staircase.bottomY, staircase.returnZ], staircase.lowerWidth, staircase.count / 2),
]
export const stairTurn = new StairTurn([staircase.turnX, (staircase.z + staircase.returnZ) / 2], staircase.bottomY / 2, (staircase.z - staircase.returnZ) / 2, staircase.width, staircase.lowerWidth, -1)
export const stairBlocks = stairFlights.flatMap(flight => flight.blocks)
/** the rectangle on the ground the descending flights and U-turn cover, wholly east of Moonfall’s east wall */
export const stairwayFootprint = {
  x: Math.min(...stairBlocks.map(block => block.position[0] - block.size[0] / 2)),
  z: Math.min(stairTurn.outerCenterZ - stairTurn.outerRadius, ...stairBlocks.map(block => block.position[2] - block.size[2] / 2)),
  x2: stairTurn.center[0] + stairTurn.outerRadius,
  z2: Math.max(stairTurn.outerCenterZ + stairTurn.outerRadius, ...stairBlocks.map(block => block.position[2] + block.size[2] / 2)),
}
export const stairRoofs: Array<StairBeam> = stairFlights.map(flight => flight.beam(stairHeadroom, 0.18, flight.width))
export function stairRailGeometry(side: 'inner' | 'outer') {
  const start = stairFlights[0].start
  const end = stairFlights[1].end
  return new StairHandrailGeometry(stairTurn, side, [start[0], start[1]], [end[0], end[1]])
}

export function stairFloorHeight(x: number, z: number) {
  if (insideApproachPlan(x, z)) {
    return stairApproach.y
  }
  if (stairTurn.contains(x, z)) {
    return stairTurn.top
  }
  return stairBlocks.find(block => Math.abs(x - block.position[0]) <= block.size[0] / 2 + 1e-9 && Math.abs(z - block.position[2]) <= block.size[2] / 2 + 1e-9)?.top
}

export function insideStairway([x, y, z]: Vec3) {
  const floor = stairFloorHeight(x, z)
  return floor !== undefined && y >= floor - 1 && y <= floor + stairHeadroom
}

export default staircase
