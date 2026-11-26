import {fineRange} from './canvasSurface.ts'

/**
 * what in a work’s surroundings can change how a canvas material looks:
 * - `angle`: the direction the camera looks at the print from, where the material’s own shading reads it, beyond what every physical surface’s gloss and sheen do with it
 * - `distance`: how much of the print a pixel spans, by which the material fades or filters its features
 * - `time`: the clock
 * - `light`: the room’s lamps, on its relief, gloss and sheen, or as the key light a foil follows
 * - `texture`: what of the work’s image it reads, like its luminance, its color channels or their slopes
 */
export const influenceBases = ['angle', 'distance', 'time', 'light', 'texture'] as const
/** one of the things that can change how a canvas material looks, see {@link influenceBases} */
export type InfluenceBase = typeof influenceBases[number]
/** one thing a canvas material’s look answers, with how it does */
export type Influence = {
  base: InfluenceBase
  description?: string
}

/** two significant digits of a length in millimeters */
const digits = (meters: number) => Number((meters * 1000).toPrecision(2))
/** A length in millimeters to two significant digits, like `3.2 mm`. */
export const millimeters = (meters: number) => `${digits(meters)}\u{202F}mm`
/** The pixel footprints over which `fine(size)` fades features of `size` meters at scale 1 out on a material of `scale`, like `0.45–1.8 mm per pixel`. */
export function fades(size: number, scale: number) {
  const [from, to] = fineRange(size, scale)
  return `${digits(from)}–${millimeters(to)} per pixel`
}
