import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'

import {rollOnStep, studioSteps} from './steps.ts'

/** how large the Studio is, which every seed rolls anew but the default one */
export type StudioPlan = {
  /** the clear floor between the walls’ faces, along x and z, in meters */
  clear: readonly [width: number, depth: number]
  /** how high the walls rise, and the ceiling’s underside over them hangs, in meters */
  height: number
}

/** how thick the ceiling’s slab is: as thin as a sheet, since the light falls through it at a slant, which a thicker slab would shut out of the smallest holes */
export const studioSlab = 0.03
/** how wide a rim of plain ceiling the openings leave along the walls, in meters */
export const studioRim = 0.4
/** The Studio’s size in the default environment: 8 × 8 m under a ceiling 8 m up. */
export const defaultStudioPlan: StudioPlan = {
  clear: [8, 8],
  height: 8,
}
/** what other seeds roll the Studio’s size from, each evenly between its bounds, in meters */
export const studioPlanRanges = {
  width: [8, 16],
  depth: [8, 16],
  height: [6, 10],
} as const satisfies Record<string, readonly [min: number, max: number]>

/** The Studio’s size in the environment of `seed`: the default one for the default seed, otherwise its width, depth and height each rolled within {@link studioPlanRanges} in whole meters, every one as likely. */
export function studioPlan(seed: number): StudioPlan {
  if (isDefaultSeed(seed)) {
    return defaultStudioPlan
  }
  const random = environmentRandom(seed).makeChild(['studio', 'plan'])
  const roll = (key: keyof typeof studioPlanRanges) => rollOnStep(random.makeChild(key), studioPlanRanges[key], studioSteps.size)
  return {
    clear: [roll('width'), roll('depth')],
    height: roll('height'),
  }
}

/** How far the openings may spread either way from the ceiling’s middle, x and z: all of a ceiling over the clear floor `clear` inside its rim. */
export function openingSpread(clear: StudioPlan['clear']) {
  return clear.map(span => span / 2 - studioRim) as [x: number, z: number]
}

/** How far the light from `toLight` (any length, pointing up) moves sideways between the floor and the top of a ceiling whose underside hangs `height` over it, x and z: the ceiling’s point that lights a point of the floor lies that far from it. */
export function ceilingShift([x, y, z]: readonly [number, number, number], height: number) {
  return [x / y * height, z / y * height] as const
}
