import type {FloorRectangle} from './floors.ts'
import type {Vec3} from './types.ts'

import lobby from './lobby.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'

/** a part of the Antechamber around a rectangular floor plan in the museum’s x and z */
export type AntechamberPart = FloorRectangle & {
  /** how high its ceiling hangs over its floor, its walls stopping 30 cm short of it */
  height: number
}

/** how thick the flat ceilings of the wings, the gallery and the landing are, like the middle’s slab under its dome */
export const antechamberCeilingThickness = 0.18
/** How high the underside of a flat ceiling over the part of the room hangs: like the middle’s slab under its dome, 11 cm under the top of the walls, which run up into it. */
export const antechamberCeilingUnderside = (part: AntechamberPart) => part.height - 0.11
/** the Antechamber’s domed middle, south of the Lobby, a meter short of a cube */
const middle = {
  center: [0, lobby.southZ + 4],
  size: [8, 8],
  height: 7,
} as const satisfies AntechamberPart
const [middleX, middleZ] = middle.center
const [middleWidth, middleDepth] = middle.size
/** how wide each wing is, three of the floor’s 2 m tiles; as deep as the middle, so their tiles line up with its own */
const wingWidth = 6
/** how high the wings and the gallery are, enough for their cornices to clear the casings of the doorways */
const annexHeight = 5
/**
 * The two wings off the middle’s side walls, each through a doorway in the middle of the wall they share with it, flush with the middle’s north and south walls.
 * Out of the west one, the gallery leads south toward the stairs down to Moonfall; out of the east one, a flight climbs east toward the floor above.
 * Seen through the doorway from the Lobby, a wing only shows its own walls: neither the gallery nor the flight lines up with both doorways.
 */
export const antechamberWings = {
  west: {
    center: [middleX - (middleWidth + wingWidth) / 2, middleZ],
    size: [wingWidth, middleDepth],
    height: annexHeight,
  },
  east: {
    center: [middleX + (middleWidth + wingWidth) / 2, middleZ],
    size: [wingWidth, middleDepth],
    height: annexHeight,
  },
} as const satisfies Record<string, AntechamberPart>
const westWing = antechamberWings.west
const eastWing = antechamberWings.east
/** how wide the gallery is, two of the floor’s tiles */
const galleryWidth = 4
/** where it begins, along the west wing’s south wall */
const galleryNorthZ = westWing.center[1] + middleDepth / 2
/** where it ends: at the line of Moonfall’s south wall, where the stairs set out as soon as nothing of the hall lies under them, so its ceiling rises right up to the floor’s slab */
const gallerySouthZ = lowerGallery.moonfall.center[1] + lowerGallery.moonfall.size[1] / 2
/**
 * The skylit gallery south from the west wing, level all along over Moonfall, to the head of the stairs down into it.
 * Flush with the wing’s west wall, so its tiles line up with the wing’s, and its long east wall keeps the stairs out of sight of the doorway between the wing and the domed middle, and with that of the Lobby.
 */
export const antechamberGallery = {
  center: [westWing.center[0] - wingWidth / 2 + galleryWidth / 2, (galleryNorthZ + gallerySouthZ) / 2],
  size: [galleryWidth, gallerySouthZ - galleryNorthZ],
  height: annexHeight,
} as const satisfies AntechamberPart

/** every doorway of the Antechamber, as wide and as high as the one from the Lobby, with the stair openings as wide as their flights */
export const antechamberDoorway = {
  width: lobby.antechamberDoorWidth,
  height: 3.6,
} as const

/** how high each riser of the Antechamber’s stairs is, the same as on the stairs down to Moonfall, 44 of which span its 8 m */
export const antechamberRiser = -lowerGallery.floorY / 44
/** how deep each tread is, the same as on the stairs down to Moonfall */
export const antechamberTread = 9.2 / 22
/** how many risers the flight out of the east wing climbs: half of the 34 up to a floor clear of the ground floor’s ceilings, whose slabs reach 5.87 m */
const riseCount = 17
const riseFootX = eastWing.center[0] + wingWidth / 2
const riseHeadX = riseFootX + riseCount * antechamberTread
/**
 * The flight climbing east out of the east wing, through the doorway in the middle of its east wall, to a landing half of the way up to a floor above that doesn’t exist yet.
 * Built, like every flight, down from its head to its foot.
 */
export const antechamberStairs = new StairFlight('rise', [riseHeadX, riseCount * antechamberRiser, middleZ], [riseFootX, 0, middleZ], antechamberDoorway.width, riseCount, 0, 0, 'antechamber')
/** the square landing at the head of the east wing’s flight, as wide as the flight, where it will turn on toward the floor above some day; until then, its far wall is blank */
export const antechamberLanding = {
  center: [riseHeadX + antechamberDoorway.width / 2, middleZ],
  size: [antechamberDoorway.width, antechamberDoorway.width],
  floorY: riseCount * antechamberRiser,
  height: stairHeadroom,
} as const satisfies FloorRectangle & {
  floorY: number
  height: number
}
/** the underside of the landing’s ceiling, flush with that of the flight’s, which is centered on the top of the walls */
export const antechamberLandingCeiling = antechamberLanding.floorY + antechamberLanding.height - antechamberCeilingThickness / 2

/** a round skylight in a flat ceiling, glazed with a stained-glass rosette set into its hole, a centimeter over the slab’s underside, so it glows from anywhere under it */
export type AntechamberOculus = {
  /** its middle in the museum’s x and z */
  center: readonly [number, number]
  /** which of the oculi’s palettes its glass is laid in */
  palette: number
  radius: number
  /** the height of the underside of the ceiling slab it pierces */
  underside: number
}
const [galleryX, galleryZ] = antechamberGallery.center
/** how many oculi light the gallery, evenly spaced down its middle */
const galleryOculi = 4
/** The oculi in the flat ceilings of the wings, the gallery and the landing, under the open sky like the dome. */
export const antechamberOculi: ReadonlyArray<AntechamberOculus> = [
  ...[westWing, eastWing].map(wing => ({
    center: wing.center,
    palette: 0,
    radius: 1,
    underside: antechamberCeilingUnderside(wing),
  })),
  ...Array.from({length: galleryOculi}, (_, i) => ({
    center: [galleryX, galleryZ + ((i + 0.5) / galleryOculi - 0.5) * antechamberGallery.size[1]] as const,
    palette: 1 + i % 2,
    radius: 0.7,
    underside: antechamberCeilingUnderside(antechamberGallery),
  })),
  {
    center: antechamberLanding.center,
    palette: 0,
    radius: 0.6,
    underside: antechamberLandingCeiling,
  },
]
/** the floor plans of every part of the Antechamber in the museum’s x and z, its flight and landing in one, which the stained glass of its dome and its oculi tints the sunlight in */
export const antechamberPlans: ReadonlyArray<FloorRectangle> = [
  middle,
  westWing,
  eastWing,
  antechamberGallery,
  {
    center: [(riseFootX + antechamberLanding.center[0] + antechamberLanding.size[0] / 2) / 2, middleZ],
    size: [antechamberLanding.center[0] + antechamberLanding.size[0] / 2 - riseFootX, antechamberDoorway.width],
  },
]

const inside = ({center, size}: FloorRectangle, x: number, z: number) => Math.abs(x - center[0]) <= size[0] / 2 + 1e-6 && Math.abs(z - center[1]) <= size[1] / 2 + 1e-6

/** The Antechamber’s floor height under the point in one of its wings or its gallery, which lie outside its domed middle’s floor plan, or undefined elsewhere. */
export function antechamberAnnexFloor(x: number, z: number) {
  return [westWing, eastWing, antechamberGallery].some(part => inside(part, x, z)) ? 0 : undefined
}

/** The floor height under the point on the east wing’s flight or its landing, or undefined elsewhere. */
export function antechamberStairFloor(x: number, z: number) {
  return inside(antechamberLanding, x, z) ? antechamberLanding.floorY : antechamberStairs.floorAt(x, z)
}

/** Whether the position lies on the east wing’s flight or its landing, from a meter under the floor up to its ceiling. */
export function insideAntechamberStairs([x, y, z]: Vec3) {
  if (inside(antechamberLanding, x, z)) {
    return y >= antechamberLanding.floorY - 1 && y <= antechamberLanding.floorY + antechamberLanding.height
  }
  return antechamberStairs.contains([x, y, z])
}

export default middle
