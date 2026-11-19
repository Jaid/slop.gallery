import type {RoomWall} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import {siennaVesperArch} from '#src/lib/gallery/sienna.ts'
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
const south = planWall(size, 'south', height)

export default {
  north: planWall(size, 'north', height),
  west: planWall(size, 'west', height),
  // The arch through to the Sienna, cut by the south-east corner where the Sienna’s north wall has it.
  south: {
    ...south,
    holes: {
      sienna: doorway(wallCoordinates(south, [siennaVesperArch.x - originX, 0, siennaVesperArch.z - originZ])),
    },
  },
  // The arch through to the Lobby, cut where the Lobby’s west wall has it.
  east: {
    ...east,
    holes: {
      lobby: doorway(wallCoordinates(east, [-lobby.width / 2 - originX, 0, lobby.sideDoorZ - originZ])),
    },
  },
} satisfies Record<string, RoomWall>
