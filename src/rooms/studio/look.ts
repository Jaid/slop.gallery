import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'
import type {Vec3} from 'math'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'
import {sunDirectionFromAngles} from '#src/lib/gallery/sun.ts'

/** how the Studio is lit and its works are framed, which every seed rolls anew but the default one */
export type StudioLook = {
  /** the faint fill from no visible source: the intensities of its ambient and its hemisphere light */
  fill: {
    ambient: number
    hemisphere: number
  }
  /** the floor’s mirror: a factor on its finish’s reflectance, and the radius of its blur in pixels of a 1080-row image, or undefined for the finish’s own */
  floor: {
    blur: number | undefined
    strength: number
  }
  /** the frame every work in the room hangs in */
  frame: PortraitFrameId
  /** the lamp of the Cell’s chandelier, which hangs over the middle of the floor without the chandelier */
  lamp: {
    decay: number
    /** over the floor, in meters */
    height: number
    /** in candela */
    strength: number
    /** as #rrggbb */
    tint: string
  }
  /** the moon falling in through the skylights: where it stands, in degrees clockwise from north and over the horizon, and how strongly it shines */
  moon: {
    azimuth: number
    elevation: number
    intensity: number
  }
}

/** the frames a seed rolls one of for all of the Studio’s works, the Cell’s first */
export const studioFrames = ['louis', 'classic', 'gilding', 'barbizon', 'deco', 'kumiko', 'whistler', 'oak', 'float', 'sevres'] as const satisfies ReadonlyArray<PortraitFrameId>
/** The Studio’s look in the default environment: the Cell’s fill, lamp, moon and frame, its lamp hung higher, at 5 m, and its moon higher in the sky, so it falls through the skylights onto the floor and the lower walls, and every floor’s own mirror. */
export const defaultStudioLook: StudioLook = {
  frame: studioFrames[0],
  fill: {
    ambient: 0.15,
    hemisphere: 0.45,
  },
  floor: {
    blur: undefined,
    strength: 1,
  },
  lamp: {
    decay: 1.5,
    height: 5,
    strength: 50,
    tint: '#ffedc4',
  },
  moon: {
    azimuth: 212,
    elevation: 50,
    intensity: 7,
  },
}
/** what other seeds roll their looks from, each value evenly between its bounds */
export const studioLookRanges = {
  ambient: [0.04, 0.3],
  hemisphere: [0.1, 0.8],
  floorStrength: [0.4, 2],
  floorBlur: [0, 24],
  lampDecay: [1, 2],
  lampHeight: [3, 7],
  lampStrength: [20, 90],
  /** from candlelight to cool white */
  lampKelvin: [2200, 6500],
  /** round the south-southwest and high enough that the moon falls through the skylights onto the floor and the lower walls */
  moonAzimuth: [200, 228],
  moonElevation: [40, 65],
  moonIntensity: [3, 12],
} as const satisfies Record<string, readonly [min: number, max: number]>

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits
const hex = (channel: number) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')

/** The color of a black body at the temperature in kelvin, as #rrggbb, after Tanner Helland’s fit to the CIE 1964 color matching functions, good from 1000 to 40 000 K. */
export function kelvinTint(kelvin: number) {
  const t = kelvin / 100
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492
  const blue = t >= 66 ? 255 : (t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307)
  return `#${hex(red)}${hex(green)}${hex(blue)}`
}

/** The Studio’s look in the environment of `seed`: the default one’s for the default seed, otherwise every value rolled on its own within {@link studioLookRanges} and one of the {@link studioFrames}. */
export function studioLook(seed: number): StudioLook {
  if (isDefaultSeed(seed)) {
    return defaultStudioLook
  }
  const random = environmentRandom(seed).makeChild(['studio', 'look'])
  const roll = (key: keyof typeof studioLookRanges, digits = 2) => {
    const [min, max] = studioLookRanges[key]
    return round(min + random.makeChild(key).roll() * (max - min), digits)
  }
  return {
    frame: random.makeChild('frame').rollItem(studioFrames),
    fill: {
      ambient: roll('ambient'),
      hemisphere: roll('hemisphere'),
    },
    floor: {
      blur: roll('floorBlur', 1),
      strength: roll('floorStrength'),
    },
    lamp: {
      decay: roll('lampDecay'),
      height: roll('lampHeight'),
      strength: roll('lampStrength', 0),
      tint: kelvinTint(roll('lampKelvin', -1)),
    },
    moon: {
      azimuth: roll('moonAzimuth', 1),
      elevation: roll('moonElevation', 1),
      intensity: roll('moonIntensity', 1),
    },
  }
}

/** The direction toward the moon of a look. */
export function moonDirectionOf({moon: {azimuth, elevation}}: StudioLook): Vec3 {
  return sunDirectionFromAngles(azimuth, elevation)
}
