import type {Channels} from 'okhsl'
import type StableRandom from 'stable-random'

import {integer} from 'okhsl'

/** how far a color may stray from its own in OkHSL, either way: hue in degrees, saturation and lightness in percent; a missing axis stays put */
export type HslSpread = {
  hue?: number
  lightness?: number
  saturation?: number
}

/**
 * How far `random` moves a color on each axis, each up to its `spread` either way.
 *
 * The hue is rolled by `random` itself, saturation and lightness by children of their own, so the hue a seed rolls doesn’t depend on whether the other axes spread at all. A {@link StableRandom} rolls the same every time it is asked, so colors shifted by the same `random` and `spread` all move alike.
 */
export function rollHslShift(random: StableRandom, {hue = 0, lightness = 0, saturation = 0}: HslSpread): Channels {
  return [
    hue ? random.rollRadius(hue) : 0,
    saturation ? random.makeChild('saturation').rollRadius(saturation) : 0,
    lightness ? random.makeChild('lightness').rollRadius(lightness) : 0,
  ]
}

/** The OkHSL color as packed sRGB (0xRRGGBB), moved by `random` up to `spread` either way on each axis, see {@link rollHslShift}. */
export function seededHsl([hue, saturation, lightness]: Readonly<Channels>, random: StableRandom, spread: HslSpread) {
  const [h, s, l] = rollHslShift(random, spread)
  return integer(hue + h, saturation + s, lightness + l)
}

/** The OkHSL color as packed sRGB, its hue turned by `random` up to `spread` degrees either way, its saturation and lightness kept. */
export function seededHue(color: Readonly<Channels>, random: StableRandom, spread: number) {
  return seededHsl(color, random, {hue: spread})
}
