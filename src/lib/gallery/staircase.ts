import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {moonfallApproach} from './antechamber.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'
import StairHandrailGeometry from './stairs/StairHandrailGeometry.ts'
import StairTurn from './stairs/StairTurn.ts'

const staircase = {
  startX: moonfallApproach.endX,
  turnX: moonfallApproach.endX + 10,
  endX: lowerGallery.moonfall.center[0] + lowerGallery.moonfall.size[0] / 2,
  z: moonfallApproach.z,
  // Shift the return door south to put both flights outside the footprint of Moonfall’s ceiling.
  returnZ: moonfallApproach.z + 6.5,
  width: moonfallApproach.width,
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
/** Air over both runs and the turning landing, not an unbounded column through the floors above. */
export const stairwayAir = [
  ...stairFlights.map(flight => ({
    min: [Math.min(flight.start[0], flight.end[0]), flight.end[1] - flight.rise, flight.start[2] - flight.width / 2] as Vec3,
    max: [Math.max(flight.start[0], flight.end[0]), flight.start[1] + stairHeadroom, flight.start[2] + flight.width / 2] as Vec3,
  })),
  {
    min: [stairTurn.center[0], stairTurn.top - 0.2, stairTurn.outerCenterZ - stairTurn.outerRadius] as Vec3,
    max: [stairTurn.center[0] + stairTurn.outerRadius, stairTurn.top + stairHeadroom, stairTurn.outerCenterZ + stairTurn.outerRadius] as Vec3,
  },
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
  return stairFlights[0].floorAt(x, z) ?? stairFlights[1].floorAt(x, z)
}

export function insideStairway([x, y, z]: Vec3) {
  const floor = stairFloorHeight(x, z)
  return floor !== undefined && y >= floor - 1 && y <= floor + stairHeadroom
}

export default staircase
