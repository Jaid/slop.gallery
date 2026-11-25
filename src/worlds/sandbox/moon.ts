import hsl from 'okhsl'

import {sunDirectionFromAngles} from '#src/lib/gallery/sun.ts'

/** toward the moon over the Sandbox, in the south-southwest: it shines through the roof lights of the Cell’s south slope onto the floor and walls of its north-eastern corner and through the round window of its west gable onto its north wall, and through the cutout of the Studio’s shade into the corner of its walls */
export const moonDirection = sunDirectionFromAngles(212, 35)
/** the moonlight’s color, which its shafts glow in too, and its strength */
export const moonlight = {
  color: hsl.integer(265, 53, 76.4),
  intensity: 7,
} as const
