import type {RoomWall} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {moonfallStairs} from '#src/lib/gallery/staircase.ts'

import {localWalls, planWall} from '../lib/walls.ts'

const {moonfall, tunnel} = lowerGallery
const height = 7.4

export default {
  north: planWall(moonfall.size, 'north', height, {
    holes: {
      exhibition: {
        u: tunnel.southX - moonfall.center[0],
        width: tunnel.width,
        height: 3.6,
        profile: 'rectangle',
      },
    },
  }),
  east: planWall(moonfall.size, 'east', height),
  south: planWall(moonfall.size, 'south', height),
  west: planWall(moonfall.size, 'west', height),
  // The stairway’s walls, down both flights and around the turn between them.
  ...localWalls('moonfall', roomOrigins.moonfall, [-1, 1].map(side => moonfallStairs.wall(side))),
} satisfies Record<string, RoomWall>
