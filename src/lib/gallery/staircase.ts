import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {antechamberGallery} from './antechamber.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'
import StairHandrailGeometry from './stairs/StairHandrailGeometry.ts'
import StairTurn from './stairs/StairTurn.ts'

const {moonfall} = lowerGallery
/**
 * The stairs from the south end of the Antechamber’s gallery down to Moonfall, wholly south of the hall, so nothing hangs under its ceiling.
 * The upper flight carries on south out of the gallery, turns east round a level landing halfway down and the lower flight returns north, arriving in Moonfall through its south wall, in line with the Lobby and the Antechamber.
 */
const staircase = {
  /** the upper flight’s centerline, the gallery’s */
  upperX: antechamberGallery.center[0],
  /** the lower flight’s centerline, the museum’s axis through the Lobby and the Antechamber */
  lowerX: 0,
  /** where both flights meet Moonfall’s south wall’s line: the upper one sets out from the gallery there, the lower one arrives in the hall there */
  wallZ: moonfall.center[1] + moonfall.size[1] / 2,
  /** where both flights meet the landing that turns them */
  turnZ: moonfall.center[1] + moonfall.size[1] / 2 + 10,
  width: 2.6,
  lowerWidth: 5,
  topY: 0,
  bottomY: lowerGallery.floorY,
  landing: 0.8,
  count: 44,
} as const
export const stairFlights = [
  new StairFlight('upper', [staircase.upperX, staircase.topY, staircase.wallZ], [staircase.upperX, staircase.bottomY / 2, staircase.turnZ], staircase.width, staircase.count / 2, staircase.landing),
  // Its treads as deep as the upper flight’s, ending a landing short of the hall.
  new StairFlight('lower', [staircase.lowerX, staircase.bottomY / 2, staircase.turnZ], [staircase.lowerX, staircase.bottomY, staircase.wallZ], staircase.lowerWidth, staircase.count / 2, 0, staircase.landing),
]
/** The landing halfway down, turning from the wider lower flight round the south to the upper one: seen from there, a right turn. */
export const stairTurn = new StairTurn([(staircase.upperX + staircase.lowerX) / 2, staircase.turnZ], staircase.bottomY / 2, (staircase.lowerX - staircase.upperX) / 2, staircase.lowerWidth, staircase.width, [0, 1])
export const stairBlocks = stairFlights.flatMap(flight => flight.blocks)
/** where the stairs arrive in Moonfall: the middle of the lower flight’s foot, in the line of the hall’s south wall */
export const stairFoot = [staircase.lowerX, staircase.wallZ] as const
/** the rectangle on the ground the stairway covers, from Moonfall’s south wall round the turn */
export const stairwayFootprint = {
  x: Math.min(...stairBlocks.map(block => block.position[0] - block.size[0] / 2)),
  z: Math.min(...stairBlocks.map(block => block.position[2] - block.size[2] / 2)),
  x2: Math.max(...stairBlocks.map(block => block.position[0] + block.size[0] / 2)),
  z2: stairTurn.outerCenter[1] + stairTurn.outerRadius,
}
export const stairRoofs: Array<StairBeam> = stairFlights.map(flight => flight.beam(stairHeadroom, 0.18, flight.width))
/** The handrail along one side of the stairs, the turn’s inner or outer wall, from the lower flight’s foot round the turn to the upper flight’s head. */
export function stairRailGeometry(side: 'inner' | 'outer') {
  return new StairHandrailGeometry(stairTurn, side, stairFlights[1].end, stairFlights[0].start)
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
