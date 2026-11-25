import {fromRgb} from 'okhsl'

/** Read the OkHSL channels back from a packed sRGB color. */
export default function unpackOkhsl(rgb: number) {
  return fromRgb(rgb >>> 16, rgb >>> 8 & 255, rgb & 255)
}
