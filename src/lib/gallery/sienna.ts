import type {PlankOptions} from '../materials/PlankMaterial.ts'
import type {FloorRectangle} from './floors.ts'

import lodge from './lodge.ts'
import {salonCeiling} from './salon.ts'

/** The Sienna’s square floor plan, west of the Lobby on the ground floor, where the layout puts it. */
const sienna = {
  center: [-14.8, 14],
  size: [12, 12],
  floorY: 0,
  height: 5.8,
} as const satisfies FloorRectangle & {
  floorY: number
  height: number
}
const westX = sienna.center[0] - sienna.size[0] / 2
const southZ = sienna.center[1] + sienna.size[1] / 2
/** Masonry between the nearest jamb and each corner, clear of the arch casing and the return wall’s trim. */
const cornerPier = 0.4
const doorWidth = 2.8
/** The arch at the east end of the north wall, in Sienna wall coordinates. Vesper cuts the same arch in its opposite face. */
export const siennaVesperDoor = {
  u: sienna.size[0] / 2 - cornerPier - doorWidth / 2,
  width: doorWidth,
  height: 3.8,
  profile: 'arch',
} as const
/** One passage width of level floor between the arches; a pier on either side. Its south wall continues Sienna’s. */
const vestibuleDepth = lodge.timberWidth + 2 * cornerPier
export const siennaVestibule = {
  center: [westX - lodge.timberWidth / 2, southZ - vestibuleDepth / 2],
  size: [lodge.timberWidth, vestibuleDepth],
  height: 4.3,
} as const satisfies FloorRectangle & {
  height: number
}

/** the vestibule’s ceiling slab, as thick as the room’s and as far under the vestibule’s height as the room’s under its own */
export const siennaVestibuleCeiling = {
  y: siennaVestibule.height - (sienna.height - salonCeiling.y),
  thickness: salonCeiling.thickness,
} as const

/** The Sienna’s floor height under the point in its vestibule, which lies outside its square floor plan. */
export function siennaVestibuleFloor(x: number, z: number) {
  const {center, size} = siennaVestibule
  return Math.abs(x - center[0]) <= size[0] / 2 + 1e-6 && Math.abs(z - center[1]) <= size[1] / 2 + 1e-6 ? sienna.floorY : undefined
}

export const siennaRugSize = [4.8, 7.2] as const
/** pile and backing together, in meters */
export const siennaRugThickness = 0.016

/** Dark timber joists under the ceiling, spanning the room’s depth, their middles `drop` under the ceiling, so their tops sit 2 cm into its slab. */
export const siennaCeilingBeam = {
  count: 4,
  width: 0.18,
  height: 0.3,
  drop: 0.24,
}

/** How high the joists’ middles hang in a room of the ceiling height. */
export function siennaCeilingBeamY(height: number) {
  return height - siennaCeilingBeam.drop
}

/**
 * Joist offsets from the room center along its width, one per equal bay with half a bay to each wall.
 * The count is even so the middle bay stays clear for the chandelier’s canopy and stem.
 */
export function siennaCeilingBeamOffsets(roomWidth: number, count = siennaCeilingBeam.count) {
  return Array.from({length: count}, (_, i) => (i + 0.5) * roomWidth / count - roomWidth / 2)
}

/** Narrow, dark-stained boards between the joists. */
export const siennaCeilingPlanks: PlankOptions = {
  axis: 'z',
  width: 0.12,
  length: [2.2, 3.8],
  figure: {
    meander: 3,
    rings: 120,
  },
  knots: 0.05,
  bevel: 0.004,
  seam: 0.003,
  seed: 29,
  roughness: 0.7,
  envMapIntensity: 0.2,
  colors: {
    dark: '#2a160c',
    light: '#4a2c1a',
    ring: '#1c0e06',
    seam: '#0c0603',
  },
}

export default sienna
