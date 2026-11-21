import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lobby from '#src/lib/gallery/lobby.ts'

/** the line across the room through its middle, which its origin lies on */
const middleZ = (lobby.northZ + lobby.southZ) / 2
/** the south edge of the glazed floor over the Oculus, relative to the room’s middle */
const glassZ = lobby.opening.center[1] + lobby.opening.size[1] / 2 - middleZ
/** the north edge of the arches into the Vesper and the Banquet, relative to the room’s middle */
const sideDoorZ = lobby.sideDoorZ - lobby.sideDoorWidth / 2 - middleZ
/** A part of the room from one line across it to another, relative to its middle, in a box like the room’s own: everything over that part of its floor plan from the slab up. */
function part(z: number, z2: number) {
  return new Geofence([{
    x: -lobby.width / 2,
    z,
    x2: lobby.width / 2,
    z2,
    floor: groundFenceY,
  }])
}

/** The Lobby’s parts from north to south. Two parts next to each other both hold the line between them, like two rooms the plane of a wall they share. */
export default {
  /** the north part with the glazed floor over the Oculus: from the north wall to the glazed floor’s south edge */
  north: part(lobby.northZ - middleZ, glassZ),
  /** the middle part around the fountain: from the glazed floor’s south edge to the north edge of the arches into the Vesper and the Banquet */
  middle: part(glassZ, sideDoorZ),
  /** the south part between the arches into the Vesper and the Banquet: from their north edge to the south wall with the doorway into the Antechamber */
  south: part(sideDoorZ, lobby.southZ - middleZ),
} satisfies Record<string, Geofence>
