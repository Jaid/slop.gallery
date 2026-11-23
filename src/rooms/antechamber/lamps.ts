import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Lamp} from '../base/Room.ts'

import {antechamber, antechamberWings, moonfallApproachBays, upperGallery, upperGalleryStair} from '#src/lib/gallery/antechamber.ts'

const [, originZ] = antechamber.center
const {west, east} = antechamberWings
const {hall: approach} = moonfallApproachBays
const {hall, landing} = upperGallery

/** Every fixture’s ceiling mounting point in world meters. */
export const antechamberFixtures = {
  west: [west.center[0], west.ceiling, west.center[1]],
  east: [east.center[0], east.ceiling, east.center[1]],
  descent_west: [approach.west + 1.3, approach.ceiling, approach.center[1]],
  descent_middle: [-1.3, approach.ceiling, approach.center[1]],
  descent_east: [approach.east - 2.4, approach.ceiling, approach.center[1]],
  stair: upperGalleryStair.beam(upperGalleryStair.headroom - 0.1, 0.18, 1).position,
  gallery_door: [5.95, hall.ceiling, hall.center[1]],
  gallery_middle: [11.4, hall.ceiling, hall.center[1]],
  gallery_landing: [landing.center[0], landing.ceiling, landing.center[1]],
  gallery_end: [24.6, hall.ceiling, hall.center[1]],
} as const satisfies Record<string, Vec3>

export default Object.fromEntries(Object.entries(antechamberFixtures).map(([id, [x, y, z]]) => {
  const descent = id.startsWith('descent_')
  const wing = id === 'west' || id === 'east'
  return [id, {
    position: [x, y - (wing ? 0.8 : 0.34), z - originZ],
    strength: wing ? 21 : 13,
    tint: descent ? '#b9ddcd' : '#ffe3b9',
    range: wing ? 6.4 : 5.5,
    decay: 1.3,
  } satisfies Lamp]
}))
