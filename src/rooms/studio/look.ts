import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'
import type {Vec3} from 'math'
import type {RollOptions} from 'stable-random'

import {easing} from 'math/time'
import hsl from 'okhsl'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'
import {sunDirectionFromAngles} from '#src/lib/gallery/sun.ts'
import {moonlight} from '#src/worlds/sandbox/moon.ts'

import {chandelierRange} from '../lib/sandboxFinish.ts'
import {studioPlan} from './plan.ts'
import {onStep, rollOnStep, studioSteps} from './steps.ts'

/** a lamp hanging over the Studio’s floor, without a fixture */
export type StudioLamp = {
  /** how wide its shadow’s edges blur, as an angle seen from the lamp in degrees, or 0 to blur as every lamp’s do */
  blur: number
  decay: number
  /** relative to the middle of the floor, in meters */
  position: Vec3
  /** how far it reaches, in meters, or 0 for no end */
  range: number
  /** in candela, 0 for a lamp that is off */
  strength: number
  /** as packed sRGB */
  tint: number
}

/** how the Studio is lit and its works are framed, which every seed rolls anew but the default one */
export type StudioLook = {
  /** the faint fill from no visible source: the intensities of its ambient and its hemisphere light */
  fill: {
    ambient: number
    hemisphere: number
  }
  /** the floor’s mirror: a factor on its finish’s reflectance, the radius of its blur in pixels of a 1080-row image, or undefined for the finish’s own, and a factor on its finish’s loss, how coarse a mip of the mirror it reads */
  floor: {
    blur: number | undefined
    loss: number
    strength: number
  }
  /** the frame every work in the room hangs in */
  frame: PortraitFrameId
  /** the primary lamp, the Cell’s chandelier’s without the chandelier, and a secondary one, which most other seeds leave off */
  lamps: {
    primary: StudioLamp
    secondary: StudioLamp
  }
  /** the moon falling in through the ceiling’s openings, on some seeds warm like the sun: where it stands, in degrees clockwise from north and over the horizon, its color as packed sRGB, how strongly it shines, how thickly the air shows its shafts, as the room’s volumetric sun, and how widely its shadow’s edges blur, as a factor on the graphics mode’s */
  moon: {
    azimuth: number
    blur: number
    color: number
    elevation: number
    intensity: number
    shafts: number
  }
}

/** the frames a seed rolls one of for all of the Studio’s works, the Cell’s first */
export const studioFrames = ['louis', 'classic', 'gilding', 'barbizon', 'deco', 'kumiko', 'whistler', 'oak', 'float', 'sevres'] as const satisfies ReadonlyArray<PortraitFrameId>
/** The Studio’s look in the default environment: the Cell’s lamp, moonlight and frame, the lamp dimmed, falling off with the square of the distance within 20 m and hung 4 m over the middle of the floor, a faint, cool slate-blue one by the west wall, a faint hemisphere fill alone, a faint moon high in the west-southwest, its shadow four times as soft as the graphics mode’s, in nearly clear air, and every floor’s mirror at half its own strength, read at full resolution and blurred 10 px wide. */
export const defaultStudioLook: StudioLook = {
  frame: studioFrames[0],
  fill: {
    ambient: 0,
    hemisphere: 0.3,
  },
  floor: {
    blur: 10,
    loss: 0,
    strength: 0.5,
  },
  lamps: {
    primary: {
      blur: 0,
      decay: 2,
      position: [0, 4, 0],
      range: 20,
      strength: 30,
      tint: hsl.integer(87, 100, 94.2),
    },
    // A tenth of the way east from the west wall, seven tenths of the way south from the north wall, two fifths of the way up.
    secondary: {
      blur: 1,
      decay: 1,
      position: [-3.2, 3.2, 1.6],
      range: chandelierRange,
      strength: 5,
      tint: hsl.integer(262, 30, 40),
    },
  },
  moon: {
    azimuth: 249,
    blur: 4,
    color: moonlight.color,
    elevation: 66,
    intensity: 5,
    shafts: 0.05,
  },
}
/** what other seeds roll their looks from, each value on its step between its bounds, every step as likely; the fill and the lamps stay dim enough for the light through the ceiling to stand out even on pale finishes */
export const studioLookRanges = {
  ambient: [0.03, 0.18],
  hemisphere: [0.08, 0.45],
  floorStrength: [0.4, 2],
  floorBlur: [0, 16],
  /** from as sharp as every lamp’s to soft, in degrees */
  lampBlur: [0, 6],
  lampDecay: [1.4, 2],
  /** off the middle of the floor along x and along z, as a share of the room’s width and depth */
  lampAside: [-0.2, 0.2],
  /** no higher than 1.5 m under the ceiling */
  lampHeight: [3, 7],
  lampStrength: [15, 55],
  /** where a secondary lamp hangs along x and along z, as a share of the room’s width and depth from its north-western corner */
  secondaryLampShare: [0.15, 0.85],
  /** how high a secondary lamp hangs, as a share of the room’s height, which leaves at least 1.5 m under the lowest ceiling */
  secondaryLampHeight: [0.3, 0.7],
  secondaryLampStrength: [10, 40],
  /** from candlelight to cool white */
  lampKelvin: [2200, 6500],
  /** from anywhere round the room, every whole degree but 360, which is 0 */
  moonAzimuth: [0, 359],
  /** from as soft as the graphics mode’s to eight times as soft */
  moonBlur: [1, 8],
  /** high enough that the shafts fall steeply through the room */
  moonElevation: [60, 85],
  /** most of them near the faint end, see {@link studioShineEasing} */
  moonIntensity: [0.5, 4],
  /** from clear air to hazy, most of them near the clear end, see {@link studioShineEasing}, on the seeds that show shafts at all, see {@link studioShaftlessChance} */
  moonShafts: [0.01, 0.2],
  /** a sun’s color temperature, from a low afternoon sun to midday */
  sunKelvin: [3800, 5600],
  /** most of them near the faint end, see {@link studioShineEasing} */
  sunIntensity: [0.8, 4],
} as const satisfies Record<string, readonly [min: number, max: number]>
/** how likely a seed lights the Studio with a warm sun instead of the moon */
export const studioSunChance = 0.35
/** how likely a seed’s floor mirrors nothing at all */
export const studioMirrorlessChance = 0.1
/** how likely a seed shows no shafts at all, its air perfectly clear */
export const studioShaftlessChance = 0.1
/** how a moon’s or sun’s strength and its shafts spread over their ranges: to the fifth power, so half of them shine within the faintest 32nd of it and only one in eight past its middle */
export const studioShineEasing = easing.quintIn
/** how likely a seed switches the secondary lamp on */
export const studioSecondaryLampChance = 0.3

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits
const byte = (channel: number) => Math.round(Math.min(255, Math.max(0, channel)))

/** The color of a black body at the temperature in kelvin, as packed sRGB, after Tanner Helland’s fit to the CIE 1964 color matching functions, good from 1000 to 40 000 K. */
export function kelvinTint(kelvin: number) {
  const t = kelvin / 100
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492
  const blue = t >= 66 ? 255 : (t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307)
  return byte(red) << 16 | byte(green) << 8 | byte(blue)
}

/**
 * The Studio’s look in the environment of `seed`: the default one’s for the default seed, otherwise every value rolled on its own within {@link studioLookRanges} onto its {@link studioSteps}, and one of the {@link studioFrames}.
 * Its lamps hang within the room the seed’s {@link studioPlan} gives, the secondary one lit on some seeds, see {@link studioSecondaryLampChance}, some show no shafts, see {@link studioShaftlessChance}, and some floors mirror nothing, see {@link studioMirrorlessChance}.
 */
export function studioLook(seed: number): StudioLook {
  if (isDefaultSeed(seed)) {
    return defaultStudioLook
  }
  const random = environmentRandom(seed).makeChild(['studio', 'look'])
  const between = (key: string, [min, max]: readonly [number, number], source = random) => min + source.makeChild(key).roll() * (max - min)
  const roll = (key: keyof typeof studioLookRanges, step: number, source = random, options?: RollOptions) => rollOnStep(source.makeChild(key), studioLookRanges[key], step, options)
  const shine = {easing: studioShineEasing}
  const sun = random.makeChild('sun').rollBoolean({chance: studioSunChance})
  const shaftless = random.makeChild('shaftless').rollBoolean({chance: studioShaftlessChance})
  const mirrorless = random.makeChild('mirrorless').rollBoolean({chance: studioMirrorlessChance})
  const {clear: [width, depth], height} = studioPlan(seed)
  /** how high the primary lamp hangs within the range, no higher than 1.5 m under the ceiling */
  const lampHeight = (key: string, [lowest, highest]: readonly [number, number]) => rollOnStep(random.makeChild(key), [lowest, Math.min(highest, height - 1.5)], studioSteps.lampPlace)
  // The secondary lamp rolls from a source of its own, so the rest of the look rolls as it did without it.
  const second = random.makeChild('secondaryLamp')
  const share = (key: string, range: readonly [number, number]) => rollOnStep(second.makeChild(key), range, studioSteps.lampShare)
  return {
    frame: random.makeChild('frame').rollItem(studioFrames),
    fill: {
      ambient: roll('ambient', studioSteps.fill),
      hemisphere: roll('hemisphere', studioSteps.fill),
    },
    floor: {
      blur: roll('floorBlur', studioSteps.mirrorBlur),
      loss: 1,
      strength: mirrorless ? 0 : roll('floorStrength', studioSteps.mirror),
    },
    lamps: {
      primary: {
        blur: roll('lampBlur', studioSteps.lampBlur),
        decay: roll('lampDecay', studioSteps.lampDecay),
        position: [onStep(between('lampAsideX', studioLookRanges.lampAside) * width, studioSteps.lampPlace), lampHeight('lampHeight', studioLookRanges.lampHeight), onStep(between('lampAsideZ', studioLookRanges.lampAside) * depth, studioSteps.lampPlace)],
        range: chandelierRange,
        strength: roll('lampStrength', studioSteps.lampStrength),
        tint: kelvinTint(roll('lampKelvin', 10)),
      },
      secondary: {
        blur: roll('lampBlur', studioSteps.lampBlur, second),
        decay: roll('lampDecay', studioSteps.lampDecay, second),
        position: [round((share('x', studioLookRanges.secondaryLampShare) - 0.5) * width, 4), round(share('height', studioLookRanges.secondaryLampHeight) * height, 4), round((share('z', studioLookRanges.secondaryLampShare) - 0.5) * depth, 4)],
        range: chandelierRange,
        strength: second.makeChild('lit').rollBoolean({chance: studioSecondaryLampChance}) ? roll('secondaryLampStrength', studioSteps.lampStrength, second) : 0,
        tint: kelvinTint(roll('lampKelvin', 10, second)),
      },
    },
    moon: {
      azimuth: roll('moonAzimuth', studioSteps.lightAngle),
      blur: roll('moonBlur', studioSteps.lightBlur),
      color: sun ? kelvinTint(roll('sunKelvin', 10)) : moonlight.color,
      elevation: roll('moonElevation', studioSteps.lightAngle),
      intensity: sun ? roll('sunIntensity', studioSteps.lightStrength, random, shine) : roll('moonIntensity', studioSteps.lightStrength, random, shine),
      shafts: shaftless ? 0 : roll('moonShafts', studioSteps.lightShafts, random, shine),
    },
  }
}

/** The direction toward the moon of a look. */
export function moonDirectionOf({moon: {azimuth, elevation}}: StudioLook): Vec3 {
  return sunDirectionFromAngles(azimuth, elevation)
}
