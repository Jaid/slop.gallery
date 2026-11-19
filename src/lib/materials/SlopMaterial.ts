import type FatedRandom from 'fated-random'

import {rollHslShift} from '../seededHsl.ts'
import SlimeMaterial from './SlimeMaterial.ts'

/** how far a Slop’s greens may stray round the hue circle from the slime’s, either way, in degrees */
export const slopHueSpread = 40

/** The slime of a Slop, and of the slop in front of the Sloperator’s face where he leaves it: the slime’s greens, their hue rolled up to {@link slopHueSpread} degrees either way by `random`, their saturation and lightness kept. */
export default class SlopMaterial extends SlimeMaterial {
  /** how many degrees round the hue circle its greens stray from the slime’s */
  readonly hueShift: number

  constructor(random: FatedRandom) {
    const [hueShift] = rollHslShift(random, {hue: slopHueSpread})
    super(hueShift)
    this.hueShift = hueShift
    this.name = 'slop'
  }
}
