import type {ProfilePoint} from './RevolvedProfileGeometry.ts'

import {wallFace, wallTop} from './architectureDimensions.ts'
import {forgeVestibule} from './forge.ts'

/**
 * The brick dome over the Forge’s round vestibule, in meters relative to the vestibule’s middle on the floor: a hemisphere springing from the face of its wall at the walls’ top, its shell as thick as the wall, so that it lands on the wall’s whole top, and open at its crown in an eye glazed over with a disc of glass on a cross of iron bars, with an iron ring round the eye inside and out.
 */
export const forgeVestibuleDome = {
  springY: wallTop,
  /** the radius of its inside, from the springing’s middle: the wall’s face */
  radius: forgeVestibule.radius - wallFace,
  /** as thick as the wall, so its outside meets the wall’s */
  thickness: wallFace * 2,
  /** the radius of the eye at its crown */
  oculus: 0.75,
  /** the radius of the iron rings’ section round the eye */
  ring: 0.035,
  /** segments up a quarter of its curve */
  segments: 24,
} as const

const {oculus, radius, segments, springY, thickness} = forgeVestibuleDome
const outer = radius + thickness
/** the eye’s rim, where it meets the inside and the outside of the shell */
const eyeBottom = springY + Math.sqrt(radius ** 2 - oculus ** 2)
const eyeTop = springY + Math.sqrt(outer ** 2 - oculus ** 2)
/** how far the inside of the shell rises from the springing to where the eye cuts it, as an angle of elevation */
const eyeElevation = Math.acos(oculus / radius)
const outerEyeElevation = Math.acos(oculus / outer)
/** The shell’s section as the revolved profile of a solid: up its inside from the springing to the eye, up the eye’s rim, down its outside and back along its base on the wall. */
const points: Array<ProfilePoint> = [
  ...Array.from({length: segments + 1}, (_, i): ProfilePoint => {
    const elevation = i / segments * eyeElevation
    return [radius * Math.cos(elevation), springY + radius * Math.sin(elevation)]
  }),
  ...Array.from({length: segments + 1}, (_, i): ProfilePoint => {
    const elevation = (1 - i / segments) * outerEyeElevation
    return [outer * Math.cos(elevation), springY + outer * Math.sin(elevation)]
  }),
  [radius, springY],
]

/** the dome’s section and the heights of the eye’s rim, where its inside and its outside meet the eye */
export const forgeDomeProfile = {
  points,
  eyeBottom,
  eyeTop,
} as const

/** the top of the glass over the eye, the vestibule’s highest point */
export const forgeDomeTopY = eyeTop + 0.01
