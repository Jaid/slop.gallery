import type {RoomWall} from '../base/Room.ts'
import type {PlanSide} from '../lib/walls.ts'

import {antechamberSize, antechamberZ, eastStair, moonfallThreshold, stairHallHeight, stairHalls} from '#src/lib/gallery/antechamber.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import staircase from '#src/lib/gallery/staircase.ts'

import {localWalls, planWall} from '../lib/walls.ts'

const arch = {
  u: 0,
  width: 2.8,
  height: 3.5,
  profile: 'arch',
} as const
const bayArch = {holes: {bay: arch}}
const stairDoor = {holes: {stairs: {
  ...arch,
  height: 3.6,
  profile: 'rectangle',
}}} as const
const hallWall = (hall: keyof typeof stairHalls, side: PlanSide, options?: Partial<RoomWall>): RoomWall => {
  const {center, size} = stairHalls[hall]
  const wall = planWall(size, side, stairHallHeight - 0.3, options)
  return {
    ...wall,
    center: [center[0] + wall.center[0], 0, center[1] - antechamberZ + wall.center[2]],
  }
}

export default {
  north: planWall(antechamberSize, 'north', 6.7, {holes: {lobby: {
    u: 0,
    width: lobby.antechamberDoorWidth,
    height: 3.6,
    profile: 'rectangle',
  }}}),
  west: planWall(antechamberSize, 'west', 6.7, bayArch),
  east: planWall(antechamberSize, 'east', 6.7, bayArch),
  south: planWall(antechamberSize, 'south', 6.7),
  west_east: hallWall('west', 'east', bayArch),
  west_north: hallWall('west', 'north'),
  west_west: hallWall('west', 'west'),
  west_south: hallWall('west', 'south', bayArch),
  return_north: hallWall('return', 'north', bayArch),
  return_west: hallWall('return', 'west'),
  return_south: hallWall('return', 'south'),
  return_east: hallWall('return', 'east', {holes: {stairway: {
    u: moonfallThreshold.z - stairHalls.return.center[1],
    width: staircase.width,
    height: 3.6,
    profile: 'rectangle',
  }}}),
  east_west: hallWall('east', 'west', bayArch),
  east_north: hallWall('east', 'north'),
  east_south: hallWall('east', 'south'),
  east_east: hallWall('east', 'east', stairDoor),
  ...localWalls('antechamber', [0, 0, antechamberZ], [-1, 1].map(side => eastStair.wall(side))),
  stairs_end: {
    center: [eastStair.start[0], eastStair.start[1] - 0.6, 0],
    rotation: -Math.PI / 2,
    width: eastStair.width,
    height: eastStair.headroom + 0.3,
    sticky: false,
  },
} satisfies Record<string, RoomWall>
