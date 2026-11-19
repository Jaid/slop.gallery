import type {RoomWall} from '../base/Room.ts'
import type {PlanSide} from '../lib/walls.ts'

import {corridorLanding} from '#src/lib/gallery/corridor.ts'
import lodge from '#src/lib/gallery/lodge.ts'
import sienna, {siennaVesperDoor, siennaVestibule} from '#src/lib/gallery/sienna.ts'

import {planWall} from '../lib/walls.ts'

const height = sienna.height - 0.3
const {x: vesperDoorX, ...vesperArch} = siennaVesperDoor
/** The arch into the vestibule and the one out of it onto the Corridor’s landing, both as wide and as high as the Corridor. */
const arch = {
  width: lodge.timberWidth,
  height: corridorLanding.height,
  profile: 'arch',
} as const
/** The vestibule’s walls, around its square floor plan west of the arch like the room’s around its own, placed at its middle. */
const vestibuleWall = (side: PlanSide, wall: Partial<RoomWall> = {}): RoomWall => {
  const {center, ...planned} = planWall(siennaVestibule.size, side, siennaVestibule.height - 0.3, wall)
  return {
    ...planned,
    center: [center[0] + siennaVestibule.center[0] - sienna.center[0], center[1], center[2] + siennaVestibule.center[1] - sienna.center[1]],
  }
}

export default {
  // The arch through to the Vesper, near the north-east corner.
  north: planWall(sienna.size, 'north', height, {
    holes: {
      vesper: {
        ...vesperArch,
        u: vesperDoorX - sienna.center[0],
      },
    },
  }),
  // The arch into the vestibule, by the south-west corner.
  west: planWall(sienna.size, 'west', height, {
    holes: {
      vestibule: {
        ...arch,
        u: sienna.center[1] - siennaVestibule.center[1],
      },
    },
  }),
  east: planWall(sienna.size, 'east', height),
  south: planWall(sienna.size, 'south', height),
  vestibule_north: vestibuleWall('north'),
  // The back of the room’s west wall, with the same arch.
  vestibule_east: vestibuleWall('east', {
    holes: {
      sienna: {
        ...arch,
        u: 0,
      },
    },
  }),
  vestibule_south: vestibuleWall('south'),
  // The arch onto the Corridor’s landing at the top of its stair flight.
  vestibule_west: vestibuleWall('west', {
    holes: {
      corridor: {
        ...arch,
        u: 0,
      },
    },
  }),
} satisfies Record<string, RoomWall>
