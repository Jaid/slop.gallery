import type {RoomWall} from '../base/Room.ts'
import type {PlanSide} from '../lib/walls.ts'

import {antechamber, antechamberWings, moonfallApproach, moonfallApproachBays, upperGallery, upperGalleryStair, wingArches} from '#src/lib/gallery/antechamber.ts'
import lobby from '#src/lib/gallery/lobby.ts'

import {localWalls, planWall} from '../lib/walls.ts'

const [, originZ] = antechamber.center
const coreHeight = 6.7
const {west, east} = antechamberWings
const {stem, hall: approach} = moonfallApproachBays
const {threshold, hall, landing} = upperGallery
const upperY = hall.floorY
const upperHeight = hall.ceiling - upperY - 0.3
const approachHeight = approach.ceiling - 0.3
const coreArch = (side: 'east' | 'west') => {
  const {z, width, height} = wingArches[side]
  return {
    u: (z - originZ) * (side === 'east' ? 1 : -1),
    width,
    height,
    profile: 'arch',
    rise: 0.67,
  } as const
}
function wingWall(wing: typeof west, side: PlanSide, holes?: RoomWall['holes']): RoomWall {
  const wall = planWall(wing.size, side, wing.ceiling - 0.3)
  return {
    ...wall,
    center: [wall.center[0] + wing.center[0], 0, wall.center[2] + wing.center[1] - originZ],
    sticky: false,
    cornice: false,
    ...holes ? {holes} : {},
  }
}
/** Straight portions of the two passages’ outlines, whose interior seams need no walls. */
function run(side: PlanSide, fixed: number, start: number, end: number, y: number, height: number, holes?: RoomWall['holes']): RoomWall {
  const middle = (start + end) / 2
  const span = end - start
  const cross = side === 'north' || side === 'south'
  return planWall([span, span], side, height, {
    center: cross ? [middle, y, fixed - originZ] : [fixed, y, middle - originZ],
    sticky: false,
    cornice: false,
    ...holes ? {holes} : {},
  })
}

export default {
  north: planWall(antechamber.size, 'north', coreHeight, {
    holes: {lobby: {
      u: 0,
      width: lobby.antechamberDoorWidth,
      height: 3.6,
      profile: 'rectangle',
    }},
  }),
  west: planWall(antechamber.size, 'west', coreHeight, {holes: {west_wing: coreArch('west')}}),
  east: planWall(antechamber.size, 'east', coreHeight, {holes: {east_wing: coreArch('east')}}),
  south: planWall(antechamber.size, 'south', coreHeight),
  west_north: wingWall(west, 'north'),
  west_west: wingWall(west, 'west'),
  west_south: wingWall(west, 'south', {
    descent: {
      u: west.center[0] - moonfallApproach.x,
      width: moonfallApproach.width,
      height: 3.3,
      rise: 0.64,
      profile: 'arch',
    },
  }),
  west_east: wingWall(west, 'east', {court: {
    ...coreArch('west'),
    u: wingArches.west.z - west.center[1],
  }}),
  east_north: wingWall(east, 'north'),
  east_east: wingWall(east, 'east', {
    ascent: {
      u: upperGalleryStair.end[2] - east.center[1],
      width: upperGalleryStair.width,
      height: 3.42,
      rise: 0.4,
      profile: 'arch',
    },
  }),
  east_south: wingWall(east, 'south'),
  east_west: wingWall(east, 'west', {court: {
    ...coreArch('east'),
    u: east.center[1] - wingArches.east.z,
  }}),
  approach_west: run('west', stem.west, stem.north, approach.south, 0, approachHeight),
  approach_stem_east: run('east', stem.east, stem.north, stem.south, 0, approachHeight),
  approach_north: run('north', approach.north, stem.east, approach.east, 0, approachHeight),
  approach_south: run('south', approach.south, approach.west, approach.east, 0, approachHeight),
  approach_east: run('east', approach.east, approach.north, approach.south, 0, approachHeight, {
    stairway: {
      u: 0,
      width: moonfallApproach.width - 0.06,
      height: 3.42,
      casing: false,
      profile: 'rectangle',
    },
  }),
  gallery_threshold_east: run('east', threshold.east, threshold.north, threshold.south, upperY, upperHeight),
  gallery_north: run('north', hall.north, threshold.east, hall.east, upperY, upperHeight),
  gallery_west: run('west', hall.west, threshold.north, hall.south, upperY, upperHeight),
  gallery_east: run('east', hall.east, hall.north, hall.south, upperY, upperHeight),
  gallery_south_west: run('south', hall.south, hall.west, landing.west, upperY, upperHeight),
  gallery_south_east: run('south', hall.south, landing.east, hall.east, upperY, upperHeight),
  gallery_landing_west: run('west', landing.west, landing.north, landing.south, upperY, upperHeight, {
    ascent: {
      u: (landing.north + landing.south) / 2 - upperGalleryStair.start[2],
      width: upperGalleryStair.width,
      height: 3.45,
      casing: false,
      profile: 'rectangle',
    },
  }),
  gallery_landing_east: run('east', landing.east, landing.north, landing.south, upperY, upperHeight),
  gallery_landing_south: run('south', landing.south, landing.west, landing.east, upperY, upperHeight),
  ...localWalls('antechamber', [0, 0, originZ], [-1, 1].map(side => ({
    ...upperGalleryStair.wall(side),
    cornice: false,
  }))),
} satisfies Record<string, RoomWall>
