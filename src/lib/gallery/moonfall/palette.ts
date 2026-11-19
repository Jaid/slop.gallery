import type {VelvetRopeStyle} from '../../materials/VelvetRopeMaterial.ts'
import type {HslSpread} from '../../seededHsl.ts'
import type {OkhslTuple} from 'okhsl'

import {environmentRandom, isDefaultSeed} from '../../environmentSeed.ts'
import {environmentSeed} from '../../gameSeed.ts'
import {hslHex, seededHsl} from '../../seededHsl.ts'
import {readMoonfallHue} from './hueParameter.ts'

/** the OkHSL hue of Moonfall’s theme in the default environment, the teal of its planet glow */
export const defaultMoonfallHue = 186

/** The OkHSL hue of Moonfall’s theme: {@link defaultMoonfallHue} in the default environment, otherwise a whole degree rolled from the seed. */
export function moonfallHue(seed: number) {
  if (isDefaultSeed(seed)) {
    return defaultMoonfallHue
  }
  return environmentRandom(seed).makeChild(['moonfall', 'hue']).rollInteger(359)
}

/** Moonfall’s colors that turn with its theme, in OkHSL at {@link defaultMoonfallHue}; its gold, its stone, its iron and its rope keep their own. */
export const moonfallColors = {
  // the lights
  planetGlow: [186, 60, 70],
  wallLed: [189, 40, 76],
  stairs: [186, 53, 80],
  // warm against the theme: the ember lamp and the lava glowing in the crater’s cracks
  ember: [53, 41, 58],
  lava: [38, 100, 63],
  // what glows without lighting anything
  ledStrip: [186, 45, 74],
  floorLine: [190, 44, 54],
  stepLight: [185, 37, 57],
  ring: [190, 56, 68],
  // the dark room and its stairway
  wall: [223, 41, 16],
  trim: [218, 30, 23],
  ceiling: [249, 35, 9],
  beam: [232, 33, 15],
  ledHousing: [231, 35, 12],
  stairway: [221, 26, 23],
  stairwayCeiling: [227, 34, 12],
  // the Orbit frame
  frameTint: [214, 53, 14],
  framePile: [215, 54, 9],
  frameCrushed: [214, 63, 19],
  frameSheen: [190, 75, 61],
  frameTail: [187, 80, 87],
} as const satisfies Record<string, OkhslTuple>

/** Moonfall’s themed colors as sRGB hex strings, see {@link moonfallColors}. */
export type MoonfallPalette = Record<keyof typeof moonfallColors, string>

/** Moonfall’s themed colors turned round the hue circle together, so the planet glow takes `hue`, their saturation and lightness kept. */
export function moonfallPalette(hue: number): MoonfallPalette {
  const turn = hue - defaultMoonfallHue
  return Object.fromEntries(Object.entries(moonfallColors).map(([key, [h, saturation, lightness]]) => [key, hslHex([h + turn, saturation, lightness])])) as MoonfallPalette
}

/** the garnet velvet of the rope round Moonfall’s crater in OkHSL */
export const moonfallRopeColors = {
  deep: [352, 59, 10],
  pile: [12, 80, 41],
  sheen: [9, 66, 59],
} as const satisfies Record<keyof VelvetRopeStyle, OkhslTuple>

/** how far the rope’s velvet may stray from {@link moonfallRopeColors} in OkHSL, either way, as far as the Salon ottoman’s */
export const moonfallRopeSpread = {
  hue: 20,
  saturation: 0,
  lightness: 3,
} as const satisfies HslSpread

/** The stream the velvet of Moonfall’s rope is rolled from. */
export const moonfallRopeRandom = (seed: number) => environmentRandom(seed).makeChild(['moonfall', 'rope'])

/** The velvet of the rope round Moonfall’s crater: {@link moonfallRopeColors}, all moved alike by the seed up to {@link moonfallRopeSpread}, except in the default environment. */
export function moonfallRope(seed: number, spread: HslSpread = moonfallRopeSpread): VelvetRopeStyle {
  const random = moonfallRopeRandom(seed)
  const moved = isDefaultSeed(seed) ? {} : spread
  return {
    deep: seededHsl(moonfallRopeColors.deep, random, moved),
    pile: seededHsl(moonfallRopeColors.pile, random, moved),
    sheen: seededHsl(moonfallRopeColors.sheen, random, moved),
  }
}

/** the hue of this page’s Moonfall: `?moonfall_hue`, otherwise the one the environment seed rolls */
export const moonfallThemeHue = readMoonfallHue() ?? moonfallHue(environmentSeed)

/** this page’s Moonfall’s themed colors */
export const moonfallTheme = moonfallPalette(moonfallThemeHue)
