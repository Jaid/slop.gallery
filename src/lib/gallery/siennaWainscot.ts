import type {JoineryWoodOptions} from '../materials/JoineryWoodMaterial.ts'
import type {Wall} from '../placement/wallGeometry.ts'

import {wallOpeningTrim} from './architectureDimensions.ts'
import wallDressingSpans from './wallDressingSpans.ts'

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
    dark: '#1f0f07',
    light: '#432613',
    ring: '#120803',
  },
  seed: 3,
}

/** Fit whole panels of about 2 m between the corner and the casing, leaving the narrow corner piers in damask. */
export function siennaWainscot(wall: Pick<Wall, 'holes' | 'width'>) {
  // Leave a reveal at each return, just beyond the projecting rail of the neighboring wall.
  return wallDressingSpans(wall, wallOpeningTrim, 0.2).flatMap(([start, end]) => {
    const count = Math.round((end - start) / siennaWainscotPanel.width)
    return Array.from({length: count}, (_, i) => {
      const width = (end - start) / count
      return {
        u: start + (i + 0.5) * width,
        width,
      }
    })
  })
}
