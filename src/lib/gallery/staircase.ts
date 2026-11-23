import type {StairBeam} from './stairs/StairFlight.ts'
import type {Vec3} from './types.ts'

import {antechamberEastWing, antechamberHallCenter, antechamberWing, moonfallLandingSouth, moonfallPassage} from './antechamber.ts'
import lowerGallery from './lowerGallery.ts'
import StairFlight, {stairHeadroom} from './stairs/StairFlight.ts'

/** the width of the stairway up to the gallery */
const galleryWidth = 2.6
/** where the east wing’s east wall stands, which the gallery stair arrives at */
const galleryDoorX = antechamberEastWing.center[0] + antechamberWing.size[0] / 2
/**
 * The two stairways of the Antechamber.
 * The Moonfall stair leaves the landing at the end of the west passage and runs east, dropping into the south of Moonfall clear of the crater.
 * The gallery stair leaves the east wing and climbs east to a short landing.
 */
const staircase = {
  // The hall stays where it was, south of the Lobby.
  z: antechamberHallCenter[1],
  width: 2,
  galleryWidth,
  topY: 0,
  bottomY: lowerGallery.floorY,
  landing: 0.8,
  moonfall: {
    // The east edge of the landing, on its centerline.
    x: moonfallPassage.west + moonfallPassage.width,
    z: (moonfallPassage.south + moonfallLandingSouth) / 2,
    run: 13.2,
    count: 44,
  },
  gallery: {
    doorX: galleryDoorX,
    z: antechamberEastWing.center[1],
    /** how far the gallery’s floor lies over the Antechamber’s */
    rise: 4.6,
    /** how far the flight runs past the wing’s east wall */
    run: 12,
    count: 26,
    landing: 1.2,
  },
} as const

/** the flight from the west passage’s landing down into Moonfall */
export const moonfallStairs = new StairFlight('moonfall', [staircase.moonfall.x, staircase.topY, staircase.moonfall.z], [staircase.moonfall.x + staircase.moonfall.run, staircase.bottomY, staircase.moonfall.z], staircase.width, staircase.moonfall.count)
/** the flight from the gallery down to the east wing */
export const galleryStairs = new StairFlight('gallery', [staircase.gallery.doorX + staircase.gallery.run, staircase.gallery.rise, staircase.gallery.z], [staircase.gallery.doorX, staircase.topY, staircase.gallery.z], staircase.galleryWidth, staircase.gallery.count, staircase.gallery.landing, staircase.landing, 'antechamber')

export const stairFlights = [moonfallStairs, galleryStairs]
export const stairBlocks = stairFlights.flatMap(flight => flight.blocks)
/** the rectangle on the ground a flight covers */
const flightFootprint = (flight: StairFlight) => ({
  x: Math.min(...flight.blocks.map(block => block.position[0] - block.size[0] / 2)),
  z: Math.min(...flight.blocks.map(block => block.position[2] - block.size[2] / 2)),
  x2: Math.max(...flight.blocks.map(block => block.position[0] + block.size[0] / 2)),
  z2: Math.max(...flight.blocks.map(block => block.position[2] + block.size[2] / 2)),
})
/** the rectangle the stairway down to Moonfall covers */
export const moonfallStairwayFootprint = flightFootprint(moonfallStairs)
/** the rectangle the stairway up to the gallery covers */
export const galleryStairwayFootprint = flightFootprint(galleryStairs)
/** both stairways’ footprints, the one down to Moonfall first */
export const stairwayFootprints = [moonfallStairwayFootprint, galleryStairwayFootprint]

export const stairRoofs: Array<StairBeam> = stairFlights.map(flight => flight.beam(stairHeadroom, 0.18, flight.width))

/**
 * Where Moonfall’s ceiling opens for the stair dropping through it.
 * The opening covers the headroom, so a person on the upper steps is not inside the slab.
 */
export const moonfallStairwell = {
  x: moonfallStairs.start[0] - 0.4,
  x2: moonfallStairs.start[0] + 8.4,
  z: moonfallStairs.start[2] - moonfallStairs.width / 2 - 0.4,
  z2: moonfallStairs.start[2] + moonfallStairs.width / 2 + 0.4,
} as const

/** The top of the tread under the point, on either stairway, or undefined off both. */
export function stairFloorHeight(x: number, z: number) {
  return stairFlights.map(flight => flight.floorAt(x, z)).find(floor => floor !== undefined)
}

/** Whether the position lies in either stairway, from a meter under its treads up to its headroom. */
export function insideStairway(position: Vec3) {
  return stairFlights.some(flight => flight.contains(position))
}

export default staircase
