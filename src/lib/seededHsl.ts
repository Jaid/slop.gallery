import type {OkhslTuple} from 'okhsl'
import type StableRandom from 'stable-random'

import {clamp} from 'math'
import {okhsl} from 'okhsl'

/** how far a color may stray from its own in OkHSL, either way: hue in degrees, saturation and lightness in percent; a missing axis stays put */
export type HslSpread = {
  hue?: number
  lightness?: number
  saturation?: number
}

/** The sRGB hex string, with its `#`, of an OkHSL color; the hue may lie anywhere round the circle, saturation and lightness are clamped to 0–100. */
export function hslHex([hue, saturation, lightness]: OkhslTuple) {
  return `#${okhsl(hue, clamp(saturation, 0, 100), clamp(lightness, 0, 100))}`
}

/**
 * How far `random` moves a color on each axis, each up to its `spread` either way.
 *
 * The hue is rolled by `random` itself, saturation and lightness by children of their own, so the hue a seed rolls doesn’t depend on whether the other axes spread at all. A {@link StableRandom} rolls the same every time it is asked, so colors shifted by the same `random` and `spread` all move alike.
 */
export function rollHslShift(random: StableRandom, {hue = 0, lightness = 0, saturation = 0}: HslSpread): OkhslTuple {
  return [
    hue ? random.rollRadius(hue) : 0,
    saturation ? random.makeChild('saturation').rollRadius(saturation) : 0,
    lightness ? random.makeChild('lightness').rollRadius(lightness) : 0,
  ]
}

/** The OkHSL color as sRGB hex, moved by `random` up to `spread` either way on each axis, see {@link rollHslShift}. */
export function seededHsl(color: OkhslTuple, random: StableRandom, spread: HslSpread) {
  const shift = rollHslShift(random, spread)
  return hslHex([color[0] + shift[0], color[1] + shift[1], color[2] + shift[2]])
}

/** The OkHSL color as sRGB hex, its hue turned by `random` up to `spread` degrees either way, its saturation and lightness kept. */
export function seededHue(color: OkhslTuple, random: StableRandom, spread: number) {
  return seededHsl(color, random, {hue: spread})
}
