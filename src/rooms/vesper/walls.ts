import type {RoomWall} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import {siennaVesperDoorway} from '#src/lib/gallery/sienna.ts'
import {vesper} from '#src/lib/gallery/vesper.ts'
import {wallCoordinates} from '#src/lib/placement/wallGeometry.ts'

import {planWall} from '../lib/walls.ts'

const {size} = vesper
const height = vesper.height - 0.3
const [originX, , originZ] = roomOrigins.vesper
const doorway = (u: number) => ({
  u,
  width: 2.8,
  height: 3.8,
  profile: 'arch',
}) as const
const east = planWall(size, 'east', height)

export default {
  north: planWall(size, 'north', height),
  west: planWall(size, 'west', height),
  // The arch through to the Sienna, opposite its north-east corner; local u runs west along this wall.
  south: planWall(size, 'south', height, {
    holes: {
      sienna: {
        ...siennaVesperDoorway,
        u: -siennaVesperDoorway.u,
      },
    },
  }),
  // The arch through to the Lobby, cut where the Lobby’s west wall has it.
  east: {
    ...east,
    holes: {
      lobby: doorway(wallCoordinates(east, [-lobby.width / 2 - originX, 0, lobby.sideDoorZ - originZ])),
    },
  },
} satisfies Record<string, RoomWall>
