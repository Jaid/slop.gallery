import type {RoomWall} from '../base/Room.ts'

import mainEntrance from '#src/lib/gallery/entrance.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import {balconyDoor, lobbyBalcony} from '#src/lib/gallery/lobbyBalcony.ts'
import {forgeWindow, lobbyWindowHole, salonWindow} from '#src/lib/gallery/lobbyWindows.ts'

const height = 5.5
const [, , originZ] = roomOrigins.lobby
/** A wall at the museum’s `z`, `x` relative to the room’s middle. */
const wall = (x: number, z: number, rotation: number, width: number, holes?: RoomWall['holes']): RoomWall => ({
  center: [x, 0, z - originZ],
  rotation,
  width,
  height,
  ...holes ? {holes} : {},
})
const doorway = (u: number) => ({
  u,
  width: lobby.sideDoorWidth,
  height: 3.8,
  profile: 'arch',
}) as const
const extensionZ = (lobby.northZ + lobby.previousNorthZ) / 2
const extensionWidth = lobby.previousNorthZ - lobby.northZ
const extensionEast = wall(lobby.width / 2, extensionZ, -Math.PI / 2, extensionWidth)
const extensionWest = wall(-lobby.width / 2, extensionZ, Math.PI / 2, extensionWidth)

export default {
  north: {
    ...wall(0, lobby.northZ, 0, lobby.width),
    reservations: [mainEntrance.reservation],
  },
  // The original side walls and doorways stay where they were; the extension only reaches on north, with the cast-glass windows into the Forge and the Salon, whose glass stands in the shared planes.
  extension_west: {
    ...extensionWest,
    holes: {
      forge_window: lobbyWindowHole(forgeWindow, extensionWest, roomOrigins.lobby),
    },
  },
  extension_east: {
    ...extensionEast,
    holes: {
      salon_window: lobbyWindowHole(salonWindow, extensionEast, roomOrigins.lobby),
    },
  },
  west: wall(-lobby.width / 2, 0, Math.PI / 2, 16, {
    vesper: doorway(-lobby.sideDoorZ),
  }),
  east: wall(lobby.width / 2, 0, -Math.PI / 2, 16, {
    banquet: doorway(lobby.sideDoorZ),
  }),
  south: {
    ...wall(0, lobby.southZ, Math.PI, lobby.width, {
      antechamber: {
        u: 0,
        width: lobby.antechamberDoorWidth,
        height: 3.6,
        profile: 'rectangle',
      },
      balcony: {
        u: -balconyDoor.x,
        width: balconyDoor.width,
        bottom: balconyDoor.bottom,
        height: balconyDoor.height,
        rise: balconyDoor.rise,
        profile: balconyDoor.profile,
      },
    }),
    cornice: false,
    height: lobbyBalcony.wallTop - 0.3,
    reservations: [{
      u: 0,
      bottom: lobbyBalcony.floorY - lobbyBalcony.slabDepth - 0.25,
      height: lobbyBalcony.floorY + lobbyBalcony.guardHeight,
      width: lobby.width,
      profile: 'rectangle',
    }],
  },
} satisfies Record<string, RoomWall>
