import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {moonfallThreshold} from './antechamber.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'
import StairHandrailGeometry from './stairs/StairHandrailGeometry.ts'
import StairTurn from './stairs/StairTurn.ts'

const staircase = {
  startX: moonfallThreshold.x,
  turnX: 14,
  endX: lowerGallery.moonfall.center[0] + lowerGallery.moonfall.size[0] / 2,
  // Behind the return at the south of the west stair hall.
  z: moonfallThreshold.z,
  // Room to flare from a narrow flight to the wider doorway as the landing turns.
  returnZ: moonfallThreshold.z + 6.5,
  width: 2.6,
  lowerWidth: 5,
  topY: 0,
  bottomY: lowerGallery.floorY,
  landing: 0.8,
  count: 44,
} as const
// Split the drop in proportion to the unequal runs. All 44 risers are the same height and both flights have nearly the same pitch.
const upperRun = staircase.turnX - staircase.startX - staircase.landing
const lowerRun = staircase.turnX - staircase.endX
const upperSteps = Math.round(staircase.count * upperRun / (upperRun + lowerRun))
const turnY = staircase.bottomY * upperSteps / staircase.count
export const stairFlights = [
  new StairFlight('upper', [staircase.startX, staircase.topY, staircase.z], [staircase.turnX, turnY, staircase.z], staircase.width, upperSteps, staircase.landing),
  new StairFlight('lower', [staircase.turnX, turnY, staircase.returnZ], [staircase.endX, staircase.bottomY, staircase.returnZ], staircase.lowerWidth, staircase.count - upperSteps),
]
export const stairTurn = new StairTurn([staircase.turnX, (staircase.z + staircase.returnZ) / 2], turnY, (staircase.returnZ - staircase.z) / 2, staircase.width, staircase.lowerWidth)
export const stairBlocks = stairFlights.flatMap(flight => flight.blocks)
/** World-space bounds of the two flights and the turn; the unoccupied space between them belongs to neither the stairway nor its fence. */
export const stairAir = [
  ...stairFlights.flatMap(flight => flight.chunks(0.1)),
  {
    min: [stairTurn.center[0], stairTurn.top, stairTurn.outerCenterZ - stairTurn.outerRadius],
    max: [stairTurn.center[0] + stairTurn.outerRadius, stairTurn.top + stairHeadroom, stairTurn.outerCenterZ + stairTurn.outerRadius],
  } as const,
]
export const stairRoofs: Array<StairBeam> = stairFlights.map(flight => flight.beam(stairHeadroom, 0.18, flight.width))
export function stairRailGeometry(side: 'inner' | 'outer') {
  const start = stairFlights[0].start
  const end = stairFlights[1].end
  return new StairHandrailGeometry(stairTurn, side, [start[0], start[1]], [end[0], end[1]])
}

export function stairFloorHeight(x: number, z: number) {
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
