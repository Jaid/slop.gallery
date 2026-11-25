import hsl from 'okhsl'

/** Format packed sRGB for CSS and Canvas 2D, including leading zeros. */
export const cssHex = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`

/** Read the OkHSL channels back from a packed sRGB color. */
export function unpackOkhsl(rgb: number) {
  return hsl.fromRgb(rgb >>> 16, rgb >>> 8 & 255, rgb & 255)
}
