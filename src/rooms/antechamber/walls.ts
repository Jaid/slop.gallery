import type {FloorRectangle} from '#src/lib/gallery/floors.ts'
import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {RoomWall} from '../base/Room.ts'
import type {PlanSide} from '../lib/walls.ts'

import antechamber, {antechamberDoorway, antechamberGallery, antechamberLanding, antechamberStairs, antechamberWings} from '#src/lib/gallery/antechamber.ts'
import {defaultBaseboardHeight} from '#src/lib/gallery/architectureDimensions.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import staircase from '#src/lib/gallery/staircase.ts'

import {localWalls, planWall} from '../lib/walls.ts'

const [originX, , originZ] = roomOrigins.antechamber
/** a doorway in the middle of its wall, as wide as the one from the Lobby */
const doorway = {
  u: 0,
  width: antechamberDoorway.width,
  height: antechamberDoorway.height,
  profile: 'rectangle',
} as const
/** The wall along a side of a part of the Antechamber, its ceiling `height` high, placed at the part’s middle relative to the room’s origin. */
const partWall = ({center, size}: FloorRectangle, height: number, side: PlanSide, wall: Partial<RoomWall> = {}): RoomWall => {
  const {center: [x, y, z], ...planned} = planWall(size, side, height - 0.3, wall)
  return {
    ...planned,
    center: [x + center[0] - originX, y, z + center[1] - originZ],
  }
}
const middle = (side: PlanSide, wall?: Partial<RoomWall>) => partWall(antechamber, antechamber.height, side, wall)
const westWing = (side: PlanSide, wall?: Partial<RoomWall>) => partWall(antechamberWings.west, antechamberWings.west.height, side, wall)
const eastWing = (side: PlanSide, wall?: Partial<RoomWall>) => partWall(antechamberWings.east, antechamberWings.east.height, side, wall)
const gallery = (side: PlanSide, wall?: Partial<RoomWall>) => partWall(antechamberGallery, antechamberGallery.height, side, wall)
/** a wall round the landing at the head of the east wing’s flight, standing on the landing, without a cornice under its low ceiling, like the flight’s */
const landing = (side: PlanSide): RoomWall => {
  const {center: [x, , z], ...wall} = partWall(antechamberLanding, antechamberLanding.height, side, {
    cornice: false,
    sticky: false,
  })
  return {
    ...wall,
    center: [x, antechamberLanding.floorY, z],
  }
}
/**
 * A wall along the east wing’s flight, without a cornice under its sloping ceiling. Its foot lies under the treads, and its baseboard reaches up from there to as high over their nosings as the baseboards round the wing and the landing stand over their floors, so it runs up the flight like a stringer from one to the other.
 */
const flightWall = (side: number): Wall => {
  const wall = antechamberStairs.wall(side)
  const grade = (antechamberStairs.start[1] + antechamberStairs.end[1]) / 2
  return {
    ...wall,
    baseboardHeight: grade - wall.center[1] + defaultBaseboardHeight,
    cornice: false,
  }
}

export default {
  // The domed middle, a doorway in the middle of every wall but the south one.
  north: middle('north', {holes: {lobby: doorway}}),
  west: middle('west', {holes: {west_wing: doorway}}),
  east: middle('east', {holes: {east_wing: doorway}}),
  south: middle('south'),
  // The west wing, its east wall the back of the middle’s west wall, opening south into the gallery.
  west_wing_north: westWing('north'),
  west_wing_west: westWing('west'),
  west_wing_east: westWing('east', {holes: {middle: doorway}}),
  west_wing_south: westWing('south', {
    holes: {
      gallery: {
        ...doorway,
        u: antechamberWings.west.center[0] - antechamberGallery.center[0],
      },
    },
  }),
  // The gallery, its north wall the back of the west wing’s south wall, its far end opening onto the stairs down to Moonfall.
  gallery_north: gallery('north', {holes: {west_wing: doorway}}),
  gallery_west: gallery('west'),
  gallery_east: gallery('east'),
  gallery_south: gallery('south', {
    holes: {
      stairway: {
        ...doorway,
        width: staircase.width,
        u: antechamberGallery.center[0] - staircase.upperX,
      },
    },
  }),
  // The east wing, its west wall the back of the middle’s east wall, its flight climbing east out of it.
  east_wing_north: eastWing('north'),
  east_wing_south: eastWing('south'),
  east_wing_west: eastWing('west', {holes: {middle: doorway}}),
  east_wing_east: eastWing('east', {holes: {stairs: {
    ...doorway,
    width: antechamberStairs.width,
  }}}),
  // Up the flight to the landing, whose east wall stays blank until a floor above is there to go on to.
  ...localWalls('antechamber', roomOrigins.antechamber, [-1, 1].map(flightWall)),
  landing_north: landing('north'),
  landing_south: landing('south'),
  landing_east: landing('east'),
} satisfies Record<string, RoomWall>
