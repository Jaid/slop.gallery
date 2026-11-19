import type {PlankOptions} from '../materials/PlankMaterial.ts'
import type {FloorRectangle} from './floors.ts'

import {wallFace} from './architectureDimensions.ts'
import {salonCeiling} from './salon.ts'
import {siennaWainscotPanel} from './siennaWainscot.ts'

/** how long each of the walls round the Sienna’s square floor plan is */
const side = 12
/**
 * How far the middle of an opening by one of the Sienna’s corners lies from the line of the wall across that corner, where it takes the place of the `panels` wainscot panels nearest the corner: halfway between the end of the paneling and that wall’s face, so equal strips of damask flank the opening’s casing.
 * The 12 m walls take six 2 m panels from corner to corner, so the paneling ends a whole number of panels short of the corner’s line.
 */
const besideCorner = (panels: number) => (panels * siennaWainscotPanel.width + wallFace) / 2
/** where the layout puts the Vesper’s middle along x, and with it the arch in the middle of its south wall */
const vesperX = -14
/** The Sienna’s square floor plan, under the Vesper’s south wall and west of it, so the Vesper’s centered south arch opens by the Sienna’s north-east corner, in the place of its north wall’s two easternmost wainscot panels. */
const sienna = {
  center: [vesperX + besideCorner(2) - side / 2, 14],
  size: [side, side],
  floorY: 0,
  height: 5.8,
} as const satisfies FloorRectangle & {
  floorY: number
  height: number
}
const westX = sienna.center[0] - side / 2
const southZ = sienna.center[1] + side / 2
/** the vestibule’s width and depth: centered on the Sienna’s arch into it, which takes the place of the south wall’s three westernmost wainscot panels, and flush with the Sienna’s west wall */
const vestibuleSize = besideCorner(3) * 2
/**
 * The vestibule south of the Sienna’s arch by its south-west corner, still the Sienna’s: a square anteroom at the Sienna’s floor, centered on that arch and flush with the Sienna’s west wall, with a second arch in its west wall, where the Corridor arrives up its stair flight.
 * Its ceiling is as low as the arches’ casings and the cornice above them allow.
 */
export const siennaVestibule = {
  center: [westX + vestibuleSize / 2, southZ + vestibuleSize / 2],
  size: [vestibuleSize, vestibuleSize],
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
