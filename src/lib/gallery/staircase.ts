import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {antechamberRiser, antechamberTread, stairHalls} from './antechamber.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'
import StairHandrailGeometry from './stairs/StairHandrailGeometry.ts'
import StairTurn from './stairs/StairTurn.ts'

const {moonfall} = lowerGallery
const lunarHall = stairHalls.east
/** where the upper flight sets out: the lunar hall’s east wall */
const startX = lunarHall.center[0] + lunarHall.size[0] / 2
const landing = 0.8
/** how many of the stairs’ 44 risers the upper flight takes: it sets out 4 m east of where the lower one arrives, so with treads as deep as its own, the lower flight takes ten more and ends a short landing before the hall */
const upperCount = 17
/**
 * The stairs from the Antechamber’s lunar hall down to Moonfall, wholly east of the hall, so nothing of them hangs under its ceiling.
 * The upper flight leaves through the middle of the lunar hall’s east wall, in line with both arches of the dome, turns round a level landing and the lower flight returns west, arriving in the middle of Moonfall’s east wall.
 */
const staircase = {
  startX,
  turnX: startX + landing + upperCount * antechamberTread,
  /** where the lower flight arrives: Moonfall’s east wall */
  endX: moonfall.center[0] + moonfall.size[0] / 2,
  /** the upper flight’s centerline, through the middle of the Antechamber */
  z: lunarHall.center[1],
  /** the lower flight’s centerline, through the middle of Moonfall */
  returnZ: moonfall.center[1],
  width: 2.6,
  lowerWidth: 5,
  topY: 0,
  bottomY: lowerGallery.floorY,
  /** how high the landing turning the flights lies */
  turnY: -upperCount * antechamberRiser,
  landing,
  upperCount,
  count: 44,
} as const
const lowerCount = staircase.count - staircase.upperCount
export const stairFlights = [
  new StairFlight('upper', [staircase.startX, staircase.topY, staircase.z], [staircase.turnX, staircase.turnY, staircase.z], staircase.width, staircase.upperCount, staircase.landing),
  // Its treads as deep as the upper flight’s, ending a short landing before the hall.
  new StairFlight('lower', [staircase.turnX, staircase.turnY, staircase.returnZ], [staircase.endX, staircase.bottomY, staircase.returnZ], staircase.lowerWidth, lowerCount, 0, staircase.turnX - staircase.endX - lowerCount * antechamberTread),
]
export const stairTurn = new StairTurn([staircase.turnX, (staircase.z + staircase.returnZ) / 2], staircase.turnY, (staircase.returnZ - staircase.z) / 2, staircase.width, staircase.lowerWidth)
export const stairBlocks = stairFlights.flatMap(flight => flight.blocks)
/** the rectangle on the ground the stairway covers, from Moonfall’s east wall round the turn */
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
