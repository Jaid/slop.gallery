import type {Vec3} from '#src/lib/gallery/types.ts'

import {Geofence} from 'geofency'

import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'
import {apseOpeningPoint, apseOpenings, bastionCurve} from '#src/lib/gallery/bastion.ts'
import {lodgeSpur} from '#src/lib/gallery/bastionNetwork.ts'
import {cisternChunks} from '#src/lib/gallery/cistern/cistern.ts'
import corridor from '#src/lib/gallery/corridor.ts'
import {floorTile, groundFenceY} from '#src/lib/gallery/floors.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import {lodgeWindow} from '#src/lib/gallery/lodge.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import {salonSouthZ} from '#src/lib/gallery/salon.ts'
import staircase, {stairwayFootprint} from '#src/lib/gallery/staircase.ts'

const {moonfall} = lowerGallery
/** where Moonfall’s east wall stands, which the stairway arrives in */
const moonfallEastX = moonfall.center[0] + moonfall.size[0] / 2
/** how high Moonfall’s own fence reaches under its floor plan, just over its ceiling */
const moonfallCeilingY = lowerGallery.floorY + 6
/** the line across the Bastion’s curve through the middle of the gate in the crown of the Oculus’ apse, on the apse wall’s center line */
const [, gateZ] = apseOpeningPoint(apseOpenings.find(({name}) => name === 'gate')!)
/** how far past either side of the Lodge’s west window the Corridor’s long hall still looks through it */
const windowReach = 1
/** the Antechamber’s side of the east jamb of the doorway between the Lobby and the Antechamber, in the face of their wall, and the south jamb of the doorway onto Moonfall’s stairway on the center line of the Antechamber’s east wall, where the stairway begins, both seen from above as x and z */
const doorJamb = [roomOrigins.lobby[0] + lobby.antechamberDoorWidth / 2, lobby.southZ + wallFace] as const
const stairwayJamb = [staircase.startX, staircase.z + staircase.width / 2] as const
/**
 * How far north in the Lobby an eye still catches a sliver of Moonfall’s stairway, through the doorway into the Antechamber and on through the one in the Antechamber’s east wall: from the face of the Lobby’s west wall, along the line of sight that grazes both jambs, whose casings only narrow it.
 */
const stairwaySightZ = doorJamb[1] - (doorJamb[0] - (roomOrigins.lobby[0] - lobby.width / 2 + wallFace)) * (stairwayJamb[1] - doorJamb[1]) / (stairwayJamb[0] - doorJamb[0])
/** the seam of the Lobby’s floor tiles next north of that, where its south part begins */
const lobbySouthZ = lobby.northZ + Math.floor((stairwaySightZ - lobby.northZ) / floorTile) * floorTile
/** A part of the Lobby from one line across it to another, in a box like the Lobby’s own: everything over that part of its floor plan from the slab up. */
function lobbyPart(z: number, z2: number) {
  return new Geofence([{
    x: roomOrigins.lobby[0] - lobby.width / 2,
    z,
    x2: roomOrigins.lobby[0] + lobby.width / 2,
    z2,
    floor: groundFenceY,
  }])
}
/** A part of the Bastion around chunks of its air, in the same boxes the Bastion fences them with: from a meter under their floor to half a meter over their vault, so it lies within the Bastion’s fence. */
function bastionPart(chunks: ReadonlyArray<{
  max: Readonly<Vec3>
  min: Readonly<Vec3>
}>) {
  return new Geofence(chunks.map(({min, max}) => ({
    x: min[0],
    z: min[2],
    x2: max[0],
    z2: max[2],
    y: min[1] - 1,
    y2: max[1] + 0.5,
  })))
}
/** The gallery’s fences beside its rooms’, by their ids, in the museum’s meters. They mark places where something happens, whatever room they lie in: so far, parts of single rooms. */
const fences = {
  /** The Lobby’s north part, with the glazed floor over the Oculus between its glass walls onto the Forge and the Salon: from its north wall to the line the Forge’s wall with the Vesper and the Salon’s with the Banquet stand on, on either side of it. */
  lobby_north: lobbyPart(lobby.northZ, salonSouthZ),
  /** The Lobby’s middle part, around its fountain: from that line to the seam of the floor’s tiles beyond which Moonfall’s stairway may show through the Antechamber, see {@link stairwaySightZ}. */
  lobby_middle: lobbyPart(salonSouthZ, lobbySouthZ),
  /** The Lobby’s south part, with the arches into the Vesper and the Banquet: from that seam to its south wall with the doorway into the Antechamber. Two parts next to each other both hold the line between them, like two rooms the plane of a wall they share. */
  lobby_south: lobbyPart(lobbySouthZ, lobby.southZ),
  /**
   * The stairway between the Antechamber and Moonfall: from the Antechamber’s east wall down its upper flight, round its turn and down its lower flight to Moonfall’s east wall.
   * Whatever of Moonfall’s fence lies outside of its hall: the stairway’s footprint at every height east of the hall’s east wall, and over the hall’s ceiling west of it, where the upper flight sets out.
   */
  moonfall_stairs: new Geofence([
    {
      ...stairwayFootprint,
      x2: moonfallEastX,
      floor: moonfallCeilingY,
    },
    {
      ...stairwayFootprint,
      x: moonfallEastX,
    },
  ]),
  /** The knight’s alley: the Bastion’s blind branch beside the Lodge, where the empty suit of armor stands with the knight’s helmet on its shoulders, from its doorway in the connecting tunnel’s wall up its ramp, past the Lodge’s side window and on to its closing wall with the barred window. */
  knight_alley: bastionPart(lodgeSpur.chunks(0.35)),
  /** The Bastion’s cistern behind the Forge’s vestibule, which the alchemy machine shoots its orbs into: from its flat wall with the window onto the vestibule to its round wall under the half dome. */
  bastion_cistern: bastionPart(cisternChunks()),
  /** The Bastion’s curve behind the crown of the Oculus’ apse, where the barred gate and the windows beside it look out over the platform and down the Oculus: north of the gate, out to the curve’s outer walls, from the corner behind the apse’s east shoulder to the chamfer before the S bend, in the curve’s own boxes cut off along the gate. */
  bastion_gate: bastionPart(bastionCurve.chunks(0.35).filter(({min}) => min[2] < gateZ).map(({min, max}) => ({
    min,
    max: [max[0], max[1], Math.min(max[2], gateZ)] as const,
  }))),
  /** The Corridor’s long hall abreast of the Lodge’s west window, which looks into the Lodge over the deep sill of its niche: from the hall’s west wall to the window’s glass, from a meter north of the window to a meter south of it, from a meter under the floor to half a meter over the hall’s crown, so it lies within the Corridor’s fence. */
  corridor_window: new Geofence([{
    x: corridor.center[0] - corridor.size[0] / 2,
    z: lodgeWindow.z - lodgeWindow.width / 2 - windowReach,
    x2: lodgeWindow.tunnelX,
    z2: lodgeWindow.z + lodgeWindow.width / 2 + windowReach,
    y: corridor.floorY - 1,
    y2: corridor.floorY + corridor.height + 0.5,
  }]),
} as const satisfies Record<string, Geofence>

export default fences
