import type {VelvetColors, VelvetStyle} from '../materials/VelvetMaterial.ts'
import type {HslSpread} from '../seededHsl.ts'

import {environmentRandom, isDefaultSeed} from '../environmentSeed.ts'
import {seededVelvet} from '../materials/VelvetMaterial.ts'

/** the Salon ottoman’s velvet in OkHSL, a darker, redder oxblood than the other velvets’ */
export const salonVelvetColors = {
  crushed: [15, 100, 25],
  deep: [8, 91.75, 4.69],
  pile: [13, 98.97, 14.06],
  sheen: [14, 98.97, 37.5],
} as const satisfies VelvetColors

/** how far the Salon ottoman’s velvet may stray from {@link salonVelvetColors} in OkHSL, either way */
export const salonVelvetSpread = {
  hue: 20,
  saturation: 0,
  lightness: 3,
} as const satisfies HslSpread

/** The stream the velvet of the Salon ottoman is rolled from. */
export const salonVelvetRandom = (seed: number) => environmentRandom(seed).makeChild(['salon', 'velvet'])

/** The velvet of the Salon ottoman: {@link salonVelvetColors}, which the seed moves up to {@link salonVelvetSpread}, except in the default environment. */
export function salonVelvet(seed: number, spread: HslSpread = salonVelvetSpread, colors: VelvetColors = salonVelvetColors): VelvetStyle {
  return seededVelvet(colors, salonVelvetRandom(seed), isDefaultSeed(seed) ? {} : spread)
}
