import type {RoomWall} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import staircase, {stairFlights, stairTurn} from '#src/lib/gallery/staircase.ts'

import {localWalls, planWall} from '../lib/walls.ts'

const {moonfall, tunnel} = lowerGallery
const height = 5.5

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
  // The stairway from the Antechamber arrives in the middle of the east wall.
  east: planWall(moonfall.size, 'east', height, {
    holes: {
      stairway: {
        u: staircase.returnZ - moonfall.center[1],
        width: staircase.lowerWidth,
        height: 3.6,
        profile: 'rectangle',
      },
    },
  }),
  south: planWall(moonfall.size, 'south', height),
  west: planWall(moonfall.size, 'west', height),
  // The stairway’s walls, down both flights and around the turn between them.
  ...localWalls('moonfall', roomOrigins.moonfall, [...stairFlights.flatMap(flight => [-1, 1].map(side => flight.wall(side))), ...stairTurn.walls()]),
} satisfies Record<string, RoomWall>
