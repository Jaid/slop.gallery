import type {RoomSpawn} from '../base/Room.ts'

import {antechamberGallery, antechamberLanding} from '#src/lib/gallery/antechamber.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'

const [originX, , originZ] = roomOrigins.antechamber

export default {
  // Just north of the middle, looking south toward the wall facing the Lobby.
  '': {
    position: [0, 0.04, -1.1],
    yaw: -Math.PI,
    pitch: 0,
  },
  // At the south end of the gallery, looking down the stairs to Moonfall; a spawn of its own id, as the camera bookmark `gallery` takes that one.
  stairhead: {
    position: [antechamberGallery.center[0] - originX, 0.04, antechamberGallery.center[1] + antechamberGallery.size[1] / 2 - 1 - originZ],
    yaw: Math.PI,
    pitch: -0.3,
  },
  // On the landing at the head of the east wing’s flight, looking back down it.
  landing: {
    position: [antechamberLanding.center[0] - originX, antechamberLanding.floorY + 0.04, antechamberLanding.center[1] - originZ],
    yaw: Math.PI / 2,
    pitch: -0.2,
  },
} satisfies Record<string, RoomSpawn>
