import type {PlankOptions} from '../materials/PlankMaterial.ts'
import type {FloorRectangle} from './floors.ts'

import {wallFace} from './architectureDimensions.ts'
import lodge from './lodge.ts'
import {salonCeiling} from './salon.ts'
import {siennaWainscotPanel} from './siennaWainscot.ts'

/** The Sienna’s square floor plan, west of the Lobby on the ground floor, where the layout puts it. */
const sienna = {
  center: [-14, 14],
  size: [12, 12],
  floorY: 0,
  height: 5.8,
} as const satisfies FloorRectangle & {
  floorY: number
  height: number
}
const westX = sienna.center[0] - sienna.size[0] / 2
const eastX = sienna.center[0] + sienna.size[0] / 2
const northZ = sienna.center[1] - sienna.size[1] / 2
const southZ = sienna.center[1] + sienna.size[1] / 2
/**
 * Where an opening in one of the Sienna’s walls by its corner with the wall along `corner` (its line, the far end of the wall’s length) takes the place of the `panels` wainscot panels nearest that corner: halfway between the end of the paneling and the face of the wall across the corner, so equal piers of paper flank the opening’s casing.
 * The 12 m walls take six 2 m panels from corner to corner, so the paneling ends a whole number of panels short of the corner’s line.
 */
const besideCorner = (corner: number, panels: number) => corner - (panels * siennaWainscotPanel.width + wallFace) / 2
/**
 * The arch through to the Vesper by the Sienna’s north-east corner, where its north wall and the Vesper’s south wall share the opening, in the place of the north wall’s two easternmost wainscot panels.
 * As wide and as high as the Vesper’s arch into the Lobby.
 */
export const siennaVesperArch = {
  x: besideCorner(eastX, 2),
  z: northZ,
  width: 2.8,
  height: 3.8,
} as const
/** the line of both of the vestibule’s arches, its arch into the Sienna by the Sienna’s south-west corner in the place of the west wall’s three southernmost wainscot panels, and the one out onto the Corridor’s landing, which the landing runs along */
export const siennaArchZ = besideCorner(southZ, 3)
/** how far the arches of the vestibule keep their jambs off its side walls */
const vestibuleInset = 0.4
/** the vestibule’s width and depth: its arches as wide as the Corridor, centered, with the inset on either side */
const vestibuleSize = lodge.timberWidth + vestibuleInset * 2
/**
 * The vestibule west of the Sienna’s arch by its south-west corner, still the Sienna’s: a square anteroom at the Sienna’s floor, centered on that arch, with a second arch in its west wall across from it, where the Corridor arrives up its stair flight.
 * Its ceiling is as low as the arches’ casings and the cornice above them allow.
 */
export const siennaVestibule = {
  center: [westX - vestibuleSize / 2, siennaArchZ],
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
