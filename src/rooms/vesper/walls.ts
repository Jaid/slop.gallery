import type {RoomWall} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import {siennaVesperDoor} from '#src/lib/gallery/sienna.ts'
import {vesper} from '#src/lib/gallery/vesper.ts'
import {wallCoordinates} from '#src/lib/placement/wallGeometry.ts'

import {planWall} from '../lib/walls.ts'

const {size} = vesper
const height = vesper.height - 0.3
const [originX, , originZ] = roomOrigins.vesper
const {x: siennaDoorX, ...siennaArch} = siennaVesperDoor
const east = planWall(size, 'east', height)

export default {
  north: planWall(size, 'north', height),
  west: planWall(size, 'west', height),
  // Match the Sienna’s north arch across the shared wall.
  south: planWall(size, 'south', height, {
    holes: {
      sienna: {
        ...siennaArch,
        u: originX - siennaDoorX,
      },
    },
  }),
  // The arch through to the Lobby, cut where the Lobby’s west wall has it.
  east: {
    ...east,
    holes: {
      lobby: {
        u: wallCoordinates(east, [-lobby.width / 2 - originX, 0, lobby.sideDoorZ - originZ]),
        width: 2.8,
        height: 3.8,
        profile: 'arch',
      },
    },
  },
} satisfies Record<string, RoomWall>
