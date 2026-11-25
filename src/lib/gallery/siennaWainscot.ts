import type {JoineryWoodOptions} from '../materials/JoineryWoodMaterial.ts'
import type {Wall} from '../placement/wallGeometry.ts'

import hsl from 'okhsl'

/**
 * One panel of the Sienna’s wainscot along its papered walls, every part a board given by its middle (y over the floor, front out of the wall’s center line) and its size: a 2 m frame of varnished wood standing on the baseboard, a darker raised field in it and a rail along its top.
 * Kept apart from the Sienna’s floor plan, so other rooms papered like it can take it without the gallery’s layout.
 */
export const siennaWainscotPanel = {
  width: 2,
  frame: {
    y: 0.92,
    front: 0.125,
    size: [2, 0.94, 0.025],
  },
  field: {
    y: 0.92,
    front: 0.145,
    size: [1.55, 0.65, 0.025],
  },
  rail: {
    y: 1.42,
    front: 0.145,
    size: [2, 0.045, 0.09],
  },
} as const

/** The wainscot’s raised fields are a shade darker than their frames, so the paneling reads in depth. */
export const siennaWainscotFields: JoineryWoodOptions = {
  colors: {
    dark: hsl.integer(48, 50, 9),
    light: hsl.integer(53, 57, 20),
    ring: hsl.integer(56, 50, 6),
  },
  seed: 3,
}

/** Centers of the 2 m wainscot panels along a wall, as many as fit, centered on it, skipping any that would run into an opening. */
export function siennaWainscot(wall: Pick<Wall, 'holes' | 'width'>) {
  const {width} = siennaWainscotPanel
  const count = Math.floor(wall.width / width)
  return Array.from({length: count}, (_, i) => (i - (count - 1) / 2) * width).filter(u => !wall.holes?.some(hole => Math.abs(u - hole.u) < hole.width / 2 + width / 2))
}
