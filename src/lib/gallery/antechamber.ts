import type {FloorRectangle} from './floors.ts'
import type {StairBlock} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {floorThickness} from './floors.ts'
import lobby from './lobby.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'

export const antechamberSize = [8, 8] as const
export const antechamberZ = lobby.southZ + antechamberSize[1] / 2
const hallSide = 6
const hallX = (antechamberSize[0] + hallSide) / 2
/**
 * The two lantern halls off the dome’s side walls, each through an arch in the middle of the wall they share with it.
 * The lunar hall in the east leads down to Moonfall, through a doorway in the middle of its east wall, in line with both arches; the solar hall in the west leads up toward a floor above, through a doorway in the middle of its south wall.
 * A line from the Lobby through its doorway and the lunar hall’s arch runs too far askew to pass the doorway beyond.
 */
export const stairHalls = {
  west: {
    center: [-hallX, antechamberZ],
    size: [hallSide, hallSide],
  },
  east: {
    center: [hallX, antechamberZ],
    size: [hallSide, hallSide],
  },
} as const satisfies Record<string, FloorRectangle>
/** how high the flat ceilings of the halls hang, their walls stopping 30 cm short of them */
export const stairHallHeight = 4.6
/** the arch from the dome into either hall, which the flight up is as wide as */
export const antechamberArch = {
  width: 2.8,
  height: 3.5,
} as const

/** how high each riser of the Antechamber’s stairs is, down to Moonfall as well as up: 44 of them span the 8 m down */
export const antechamberRiser = -lowerGallery.floorY / 44
/** how deep each tread of the Antechamber’s stairs is, down to Moonfall as well as up */
export const antechamberTread = 9.2 / 22
/** how many risers the flight out of the solar hall climbs: half of the 34 up to a floor clear of the ground floor’s ceilings, whose slabs reach 5.87 m */
const riseCount = 17
const [riseX, hallZ] = stairHalls.west.center
const riseFootZ = hallZ + hallSide / 2
const riseHeadZ = riseFootZ + riseCount * antechamberTread
/**
 * The flight climbing south out of the solar hall, through the doorway in the middle of its south wall, to a landing halfway up to a floor above that doesn’t exist yet.
 * Built, like every flight, down from its head to its foot.
 */
export const antechamberStairs = new StairFlight('up', [riseX, riseCount * antechamberRiser, riseHeadZ], [riseX, 0, riseFootZ], antechamberArch.width, riseCount, 0, 0, 'antechamber')
/**
 * The flight’s blocks as they stand on the ground: none reaches below the underside of the ground floor’s slab, which Moonfall’s ceiling rises right up to under the flight.
 * The lowest, a tread level with the hall’s floor, is no thicker than the slab.
 */
export const antechamberStairBlocks: ReadonlyArray<StairBlock> = antechamberStairs.blocks.map(block => {
  const bottom = Math.max(block.position[1] - block.size[1] / 2, -floorThickness)
  return {
    ...block,
    position: [block.position[0], (bottom + block.top) / 2, block.position[2]],
    size: [block.size[0], block.top - bottom, block.size[2]],
  }
})
/** how far the walls along the flight reach under its grade: down to the underside of the ground floor’s slab at its foot, and from there on still under every tread, each a riser lower than the grade at its back */
export const antechamberStairWallDepth = floorThickness
/** the square landing at the head of the flight, as wide as the flight, where it will turn on toward the floor above some day, into the upstairs hall; until then, its far wall is blank, and its walls wear that hall’s Clawds wallpaper already */
export const antechamberLanding = {
  center: [riseX, riseHeadZ + antechamberStairs.width / 2],
  size: [antechamberStairs.width, antechamberStairs.width],
  floorY: riseCount * antechamberRiser,
  height: stairHeadroom,
} as const satisfies FloorRectangle & {
  floorY: number
  height: number
}
/** how thick the landing’s slab and ceiling are: its slab as deep as the flight’s blocks, its ceiling as the flight’s roof, centered on the top of the walls like it */
export const antechamberLandingSlab = {
  floor: 0.6,
  ceiling: 0.18,
} as const

const inside = ({center, size}: FloorRectangle, x: number, z: number) => Math.abs(x - center[0]) <= size[0] / 2 + 1e-6 && Math.abs(z - center[1]) <= size[1] / 2 + 1e-6

/** The floor height under the point in one of the halls, which lie outside the dome’s floor plan, or undefined elsewhere. */
export function stairHallFloor(x: number, z: number) {
  return Object.values(stairHalls).some(hall => inside(hall, x, z)) ? 0 : undefined
}

/** The floor height under the point on the solar hall’s flight or its landing, or undefined elsewhere. */
export function antechamberStairFloor(x: number, z: number) {
  return inside(antechamberLanding, x, z) ? antechamberLanding.floorY : antechamberStairs.floorAt(x, z)
}

/** Whether the position lies on the solar hall’s flight or its landing, from a meter under the floor up to its ceiling. */
export function insideAntechamberStairs([x, y, z]: Vec3) {
  if (inside(antechamberLanding, x, z)) {
    return y >= antechamberLanding.floorY - 1 && y <= antechamberLanding.floorY + antechamberLanding.height
  }
  return antechamberStairs.contains([x, y, z])
}
