import type {RoomWall} from '../base/Room.ts'

import {antechamberEastWing, antechamberHall, antechamberWestWing, antechamberWing, antechamberWingDoor, moonfallLandingSouth, moonfallPassage} from '#src/lib/gallery/antechamber.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import {galleryStairs} from '#src/lib/gallery/staircase.ts'

import {localWalls, planWall} from '../lib/walls.ts'

const hall = antechamberHall.size
const wing = antechamberWing.size
// The hall’s walls reach the springing of the dome; the wings and the passage stop at their own ceiling.
const hallHeight = 6.7
const wingHeight = antechamberWing.height - 0.3
const [, , originZ] = roomOrigins.antechamber
/** A wall in the museum’s meters as one of the Antechamber’s, relative to the hall’s middle. */
const placed = (x: number, z: number, rotation: number, width: number, holes?: RoomWall['holes']): RoomWall => ({
  center: [x, 0, z - originZ],
  rotation,
  width,
  height: wingHeight,
  ...holes ? {holes} : {},
})
const arch = (u: number, width: number = antechamberWingDoor.width) => ({
  u,
  width,
  height: antechamberWingDoor.height,
  profile: 'rectangle',
}) as const
const hallNorth = originZ - hall[1] / 2
const hallSouth = originZ + hall[1] / 2
const wingNorth = hallNorth
const wingSouth = hallSouth
const westWingWest = antechamberWestWing.center[0] - wing[0] / 2
const eastWingEast = antechamberEastWing.center[0] + wing[0] / 2
const passageCenter = moonfallPassage.west + moonfallPassage.width / 2
const passageEast = moonfallPassage.west + moonfallPassage.width

export default {
  // The hall, with the Lobby’s doorway and an arch into each wing.
  north: planWall(hall, 'north', hallHeight, {
    holes: {
      lobby: {
        u: 0,
        width: lobby.antechamberDoorWidth,
        height: 3.6,
        profile: 'rectangle',
      },
    },
  }),
  west: planWall(hall, 'west', hallHeight, {
    holes: {
      west_wing: arch(0),
    },
  }),
  east: planWall(hall, 'east', hallHeight, {
    holes: {
      east_wing: arch(0),
    },
  }),
  south: planWall(hall, 'south', hallHeight),
  // The west wing. Its south wall opens into the passage down to Moonfall.
  west_wing_north: placed(antechamberWestWing.center[0], wingNorth, 0, wing[0]),
  west_wing_west: placed(westWingWest, antechamberWestWing.center[1], Math.PI / 2, wing[1]),
  west_wing_south: placed(antechamberWestWing.center[0], wingSouth, Math.PI, wing[0], {
    passage: arch(passageCenter - antechamberWestWing.center[0], moonfallPassage.width),
  }),
  // The passage and the landing it arrives on, above Moonfall’s ceiling. The west wall runs the whole way.
  passage_west: placed(moonfallPassage.west, (moonfallPassage.north + moonfallLandingSouth) / 2, Math.PI / 2, moonfallLandingSouth - moonfallPassage.north),
  passage_east: placed(passageEast, (moonfallPassage.north + moonfallPassage.south) / 2, -Math.PI / 2, moonfallPassage.south - moonfallPassage.north),
  landing_east: placed(passageEast, (moonfallPassage.south + moonfallLandingSouth) / 2, -Math.PI / 2, moonfallPassage.landing, {
    moonfall: arch(0, 2),
  }),
  landing_south: placed(passageCenter, moonfallLandingSouth, Math.PI, moonfallPassage.width),
  // The east wing. Its east wall opens onto the stairway up to the gallery.
  east_wing_north: placed(antechamberEastWing.center[0], wingNorth, 0, wing[0]),
  east_wing_east: placed(eastWingEast, antechamberEastWing.center[1], -Math.PI / 2, wing[1], {
    gallery: arch(0, galleryStairs.width),
  }),
  east_wing_south: placed(antechamberEastWing.center[0], wingSouth, Math.PI, wing[0]),
  // The gallery stair’s side walls, and the blank wall that closes its top landing.
  ...localWalls('antechamber', roomOrigins.antechamber, [-1, 1].map(side => galleryStairs.wall(side))),
  gallery_east: placed(galleryStairs.start[0], galleryStairs.start[2], -Math.PI / 2, galleryStairs.width),
} satisfies Record<string, RoomWall>
