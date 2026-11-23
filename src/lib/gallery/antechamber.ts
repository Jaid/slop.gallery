import type {FloorSize} from '#src/rooms/index.ts'

import lobby from './lobby.ts'

/** where the hall’s middle lies, south of the Lobby’s doorway */
export const antechamberHallCenter = [0, 12] as const

/** The original Antechamber, south of the Lobby’s doorway: a square hall under the dome. */
export const antechamberHall = {
  center: antechamberHallCenter,
  size: [8, 8] satisfies FloorSize,
  height: 7,
} as const

/** the square wings on either side of the hall, flush with its south wall and a little deeper than they are wide */
export const antechamberWing = {
  size: [7.2, 8] satisfies FloorSize,
  /** a flat ceiling, a step under the hall’s springing */
  height: 5.8,
} as const

const hallDepth = antechamberHall.size[1]
const wingWidth = antechamberWing.size[0]
const wingDepth = antechamberWing.size[1]
/** the hall’s south wall, which both wings share */
const southZ = antechamberHallCenter[1] + hallDepth / 2
/** the hall’s side walls, which the arches into the wings pass through */
const hallEast = antechamberHall.size[0] / 2

/** The two wings of the Antechamber, west of the hall and east of it, each flush with its south wall. */
export const antechamberWings = {
  west: {
    center: [-hallEast - wingWidth / 2, southZ - wingDepth / 2] as const,
  },
  east: {
    center: [hallEast + wingWidth / 2, southZ - wingDepth / 2] as const,
  },
} as const

/** the west wing, where the way down to Moonfall leaves through the south wall */
export const antechamberWestWing = antechamberWings.west
/** the east wing, where the stairway up to the gallery leaves through the east wall */
export const antechamberEastWing = antechamberWings.east

const westWingWest = antechamberWestWing.center[0] - wingWidth / 2
const wingSouth = southZ
/**
 * The level passage from the west wing to the south of Moonfall, where a stair can drop clear of the crater.
 * It stays east of the Sienna and runs above Moonfall’s ceiling.
 */
export const moonfallPassage = {
  west: westWingWest + 0.4,
  width: 2.4,
  north: wingSouth,
  south: 28.8,
  landing: 2.4,
} as const
/** the south edge of the landing the passage arrives on */
export const moonfallLandingSouth = moonfallPassage.south + moonfallPassage.landing

/** The floor height of a wing, the passage or the landing, or undefined in the hall and outside them. */
export function antechamberAnnexFloor(x: number, z: number) {
  const inside = (west: number, east: number, north: number, south: number) => x >= west - 1e-6 && x <= east + 1e-6 && z >= north - 1e-6 && z <= south + 1e-6
  const wing = (center: readonly [number, number]) => inside(center[0] - wingWidth / 2, center[0] + wingWidth / 2, center[1] - wingDepth / 2, center[1] + wingDepth / 2)
  if (wing(antechamberWestWing.center) || wing(antechamberEastWing.center)) {
    return 0
  }
  if (inside(moonfallPassage.west, moonfallPassage.west + moonfallPassage.width, moonfallPassage.north, moonfallLandingSouth)) {
    return 0
  }
}

/** the arch between the hall and a wing, as wide as the Lobby’s doorway into the hall and centered on the wing */
export const antechamberWingDoor = {
  width: lobby.antechamberDoorWidth,
  height: 3.6,
} as const
