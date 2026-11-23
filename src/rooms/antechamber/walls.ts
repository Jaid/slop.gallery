import type {Vec3} from '#src/lib/gallery/types.ts'
import type {RoomWall} from '../base/Room.ts'
import type {PlanSide} from '../lib/walls.ts'

import antechamber, {antechamberEastStairWalls, antechamberMoonfallDoor, antechamberNeckWalls, antechamberPavilionCenter} from '#src/lib/gallery/antechamber.ts'
import lobby from '#src/lib/gallery/lobby.ts'

import {localWalls, planWall} from '../lib/walls.ts'

const {size, neck, pavilion, eastStairs} = antechamber
const origin: Vec3 = [antechamber.center[0], 0, antechamber.center[1]]
// Taller than the other upper rooms, a meter short of a cube.
const height = antechamber.height - 0.3
const pavilionWallHeight = pavilion.height - 0.3
const neckArch = {
  width: neck.width,
  height: neck.height,
  profile: 'arch',
} as const
/** A wall around the west or east pavilion, placed relative to the Antechamber’s center. */
const pavilionWall = (side: 'east' | 'west', wallSide: PlanSide, wall: Partial<RoomWall> = {}): RoomWall => {
  const [px, pz] = antechamberPavilionCenter(side)
  const {center, ...planned} = planWall(pavilion.size, wallSide, pavilionWallHeight, wall)
  return {
    ...planned,
    center: [center[0] + px - origin[0], center[1], center[2] + pz - origin[2]],
  }
}

export default {
  north: planWall(size, 'north', height, {
    holes: {
      lobby: {
        u: 0,
        width: lobby.antechamberDoorWidth,
        height: 3.6,
        profile: 'rectangle',
      },
    },
  }),
  west: planWall(size, 'west', height, {
    holes: {
      west_neck: {
        ...neckArch,
        u: origin[2] - neck.z,
      },
    },
  }),
  east: planWall(size, 'east', height, {
    holes: {
      east_neck: {
        ...neckArch,
        u: neck.z - origin[2],
      },
    },
  }),
  south: planWall(size, 'south', height),
  // West pavilion: opens south into Moonfall’s curved approach, hidden from Lobby sightlines.
  west_north: pavilionWall('west', 'north'),
  west_west: pavilionWall('west', 'west'),
  west_east: pavilionWall('west', 'east', {
    holes: {
      neck: {
        ...neckArch,
        u: neck.z - pavilion.z,
      },
    },
  }),
  west_south: pavilionWall('west', 'south', {
    holes: {
      stairway: {
        u: 0,
        width: antechamberMoonfallDoor.width,
        height: antechamberMoonfallDoor.height,
        profile: 'rectangle',
      },
    },
  }),
  // East pavilion: opens east onto the ascending stairs toward the future upper floor.
  east_north: pavilionWall('east', 'north'),
  east_south: pavilionWall('east', 'south'),
  east_west: pavilionWall('east', 'west', {
    holes: {
      neck: {
        ...neckArch,
        u: pavilion.z - neck.z,
      },
    },
  }),
  east_east: pavilionWall('east', 'east', {
    holes: {
      upper_stairs: {
        u: eastStairs.z - pavilion.z,
        width: eastStairs.width,
        height: 3.6,
        profile: 'rectangle',
      },
    },
  }),
  ...localWalls('antechamber', origin, [...antechamberNeckWalls(), ...antechamberEastStairWalls()]),
} satisfies Record<string, RoomWall>
