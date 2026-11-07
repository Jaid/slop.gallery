import type {WallReservation} from '#src/lib/placement/wallGeometry.ts'
import type {RoomWall} from '../base/Room.ts'

import {alchemyCannon, alchemyPipe, workbench} from '#src/lib/gallery/alchemy/alchemyMachine.ts'
import {cisternWindowHole} from '#src/lib/gallery/cistern/window.ts'
import forge, {forgeTable, forgeTableCenter, forgeVestibule} from '#src/lib/gallery/forge.ts'
import {forgeArch, forgeRoundVestibule} from '#src/lib/gallery/forgeVestibule.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import {forgeWindow, lobbyWindowHole} from '#src/lib/gallery/lobbyWindows.ts'
import {roundVestibuleWall} from '#src/lib/gallery/roundVestibule.ts'
import {wallCoordinates} from '#src/lib/placement/wallGeometry.ts'

import {planWall} from '../lib/walls.ts'

const height = 5.5
const [originX, , originZ] = roomOrigins.forge
const north = planWall(forge.size, 'north', height)
const {center: [vestibuleX, vestibuleZ], radius} = forgeVestibule
const vestibule = roundVestibuleWall(forgeRoundVestibule, roomOrigins.forge, height)
const west = planWall(forge.size, 'west', height)
const east = planWall(forge.size, 'east', height)
const south = planWall(forge.size, 'south', height)
/** The stretch of the wall between the points `from` and `to` in plan, in the world’s frame, up to `top` over the floor, which something stands in front of. */
const standReservation = (wall: RoomWall, [fromX, fromZ]: readonly [number, number], [toX, toZ]: readonly [number, number], top: number): WallReservation => {
  const [from, to] = [[fromX, fromZ], [toX, toZ]].map(([x, z]) => wallCoordinates(wall, [x - originX, 0, z - originZ]))
  return {
    u: (from + to) / 2,
    width: Math.abs(to - from),
    height: top,
    profile: 'rectangle',
  }
}
const [benchX, benchZ] = workbench.center
/** The stretch of the south wall from `west` to `east`, world x coordinates, up to `top` over the floor, which the alchemy machine stands in front of. */
const machineReservation = (westX: number, eastX: number, top: number) => standReservation(south, [westX, benchZ], [eastX, benchZ], top)
const riserX = alchemyPipe.corners[1][0]
const [tableX, tableZ] = forgeTableCenter

export default {
  // The arch into the vestibule, where its round wall touches the middle of this one, which the alchemy machine’s cannon shoots orbs through.
  north: {
    ...north,
    holes: {
      vestibule: {
        ...forgeArch,
        u: wallCoordinates(north, [vestibuleX - originX, 0, vestibuleZ + radius - originZ]),
      },
    },
  },
  // The cast-glass window into the Lobby, the Salon’s mirrored, whose glass stands in the shared plane.
  east: {
    ...east,
    holes: {
      lobby_window: lobbyWindowHole(forgeWindow, east, roomOrigins.forge),
    },
  },
  // Behind the alchemy machine: its workbench, and the pipe and the cannon on the wall over it.
  south: {
    ...south,
    reservations: [
      machineReservation(benchX - workbench.length / 2, benchX + workbench.length / 2, workbench.height + 0.1),
      machineReservation(benchX - 0.35, riserX + alchemyPipe.radius + 0.1, alchemyCannon.muzzle[1] + 0.35),
    ],
  },
  // Behind the painter’s table.
  west: {
    ...west,
    reservations: [standReservation(west, [tableX, tableZ - forgeTable.length / 2], [tableX, tableZ + forgeTable.length / 2], forgeTable.height + 0.1)],
  },
  // The vestibule’s round wall, one ring facing its center, with its two arches and the window into the Bastion’s cistern on the north side, where it touches the cistern’s flat wall.
  vestibule: {
    ...vestibule,
    holes: {
      ...vestibule.holes,
      cistern: cisternWindowHole(vestibule, roomOrigins.forge),
    },
  },
} satisfies Record<string, RoomWall>
