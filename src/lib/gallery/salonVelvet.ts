import type {VelvetStyle} from '../materials/VelvetMaterial.ts'
import type {HslSpread} from '../seededHsl.ts'

import {environmentRandom, isDefaultSeed} from '../environmentSeed.ts'
import {oxbloodVelvet, seededVelvet} from '../materials/VelvetMaterial.ts'

/** how far the Salon ottoman’s velvet may stray from oxblood in OkHSL, either way */
export const salonVelvetSpread = {
  hue: 20,
  saturation: 0,
  lightness: 0,
} as const satisfies HslSpread

/** The stream the velvet of the Salon ottoman is rolled from. */
export const salonVelvetRandom = (seed: number) => environmentRandom(seed).makeChild(['salon', 'velvet'])

/** The velvet of the Salon ottoman: oxblood in the default environment, otherwise oxblood moved up to {@link salonVelvetSpread} by the seed. */
export function salonVelvet(seed: number, spread: HslSpread = salonVelvetSpread): VelvetStyle {
  if (isDefaultSeed(seed)) {
    return oxbloodVelvet
  }
  return seededVelvet(oxbloodVelvet, salonVelvetRandom(seed), spread)
}
