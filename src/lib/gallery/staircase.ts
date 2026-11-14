import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'
import StairHandrailGeometry from './stairs/StairHandrailGeometry.ts'
import StairTurn from './stairs/StairTurn.ts'

const staircase = {
  startX: 4,
  turnX: 14,
  endX: 6,
  // The upper flight leaves through the middle of the Antechamber’s east wall, which runs from the Lobby’s south wall at z = 8.
  z: 12,
  // The lower flight arrives in the middle of Moonfall’s east wall.
  returnZ: lowerGallery.moonfall.center[1],
  width: 2.6,
  lowerWidth: 5,
  topY: 0,
  bottomY: lowerGallery.floorY,
  landing: 0.8,
  count: 44,
} as const
export const stairFlights = [
  new StairFlight('upper', [staircase.startX, staircase.topY, staircase.z], [staircase.turnX, staircase.bottomY / 2, staircase.z], staircase.width, staircase.count / 2, staircase.landing),
  new StairFlight('lower', [staircase.turnX, staircase.bottomY / 2, staircase.returnZ], [staircase.endX, staircase.bottomY, staircase.returnZ], staircase.lowerWidth, staircase.count / 2),
]
export const stairTurn = new StairTurn([staircase.turnX, (staircase.z + staircase.returnZ) / 2], staircase.bottomY / 2, (staircase.returnZ - staircase.z) / 2, staircase.width, staircase.lowerWidth)
export const stairBlocks = stairFlights.flatMap(flight => flight.blocks)
/** the rectangle on the ground the stairway covers, from the Antechamber’s east wall around the turn to Moonfall’s east wall */
export const stairwayFootprint = {
  x: Math.min(...stairBlocks.map(block => block.position[0] - block.size[0] / 2)),
  z: Math.min(...stairBlocks.map(block => block.position[2] - block.size[2] / 2)),
  x2: stairTurn.center[0] + stairTurn.outerRadius,
  z2: Math.max(...stairBlocks.map(block => block.position[2] + block.size[2] / 2)),
}
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
