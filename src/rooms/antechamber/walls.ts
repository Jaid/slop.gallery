import type {FloorRectangle} from '#src/lib/gallery/floors.ts'
import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {RoomWall} from '../base/Room.ts'
import type {PlanSide} from '../lib/walls.ts'

import {antechamberArch, antechamberLanding, antechamberSize, antechamberStairs, antechamberStairWallDepth, antechamberZ, stairHallHeight, stairHalls} from '#src/lib/gallery/antechamber.ts'
import {defaultBaseboardHeight} from '#src/lib/gallery/architectureDimensions.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import staircase from '#src/lib/gallery/staircase.ts'

import {localWalls, planWall} from '../lib/walls.ts'

/** a doorway as high as the one from the Lobby, in the middle of its wall */
const doorway = {
  u: 0,
  height: 3.6,
  profile: 'rectangle',
} as const
const arch = {holes: {arch: {
  u: 0,
  ...antechamberArch,
  profile: 'arch',
}}} as const
/** The wall along a side of a rectangle of the room’s floor plans, its ceiling `height` high, placed relative to the room’s origin. */
const partWall = ({center, size}: FloorRectangle, height: number, side: PlanSide, wall?: Partial<RoomWall>): RoomWall => {
  const {center: [x, y, z], ...planned} = planWall(size, side, height - 0.3, wall)
  return {
    ...planned,
    center: [x + center[0], y, z + center[1] - antechamberZ],
  }
}
const dome = (side: PlanSide, wall?: Partial<RoomWall>) => partWall({
  center: [0, antechamberZ],
  size: antechamberSize,
}, 7, side, wall)
const hall = (id: keyof typeof stairHalls, side: PlanSide, wall?: Partial<RoomWall>) => partWall(stairHalls[id], stairHallHeight, side, wall)
/** a wall round the landing at the head of the solar hall’s flight, standing on the landing, without a cornice under its low ceiling, like the flight’s */
const landing = (side: PlanSide): RoomWall => {
  const {center: [x, , z], ...wall} = partWall(antechamberLanding, antechamberLanding.height, side, {
    cornice: false,
    sticky: false,
  })
  return {
    ...wall,
    center: [x, antechamberLanding.floorY, z],
  }
}
/**
 * A wall along the solar hall’s flight, without a cornice under its raking roof. Its foot lies under the treads, and its baseboard reaches up from there to as high over their nosings as the baseboards round the hall and the landing stand over their floors, so it runs up the flight like a stringer from one to the other.
 */
const flightWall = (side: number): Wall => {
  const wall = antechamberStairs.wall(side, antechamberStairWallDepth)
  return {
    ...wall,
    baseboardHeight: antechamberStairWallDepth + defaultBaseboardHeight,
    cornice: false,
  }
}

export default {
  // The dome, an arch into either hall and the doorway from the Lobby.
  north: dome('north', {holes: {lobby: {
    ...doorway,
    width: lobby.antechamberDoorWidth,
  }}}),
  west: dome('west', arch),
  east: dome('east', arch),
  south: dome('south'),
  // The solar hall, its east wall the back of the dome’s west wall, its flight climbing south out of it.
  west_east: hall('west', 'east', arch),
  west_north: hall('west', 'north'),
  west_west: hall('west', 'west'),
  west_south: hall('west', 'south', {holes: {stairs: {
    ...doorway,
    width: antechamberStairs.width,
  }}}),
  // The lunar hall, its west wall the back of the dome’s east wall, the stairs down to Moonfall leaving it in line with both arches.
  east_west: hall('east', 'west', arch),
  east_north: hall('east', 'north'),
  east_south: hall('east', 'south'),
  east_east: hall('east', 'east', {holes: {stairway: {
    ...doorway,
    width: staircase.width,
  }}}),
  // Up the flight to the landing, whose south wall stays blank until a floor above is there to go on to.
  ...localWalls('antechamber', [0, 0, antechamberZ], [-1, 1].map(flightWall)),
  landing_west: landing('west'),
  landing_east: landing('east'),
  landing_south: landing('south'),
} satisfies Record<string, RoomWall>
