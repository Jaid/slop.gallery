import optis from 'optis'
import readPermalink from 'read-permalink'

/** A whole degree from 0 to 359, given as a number or as a string of decimal digits; anything else is `undefined`. */
function parseHue(value: unknown) {
  const text = typeof value === 'number' ? String(value) : value
  if (typeof text !== 'string' || !/^\d{1,3}$/.test(text)) {
    return
  }
  const hue = Number(text)
  return hue < 360 ? hue : undefined
}
const hueSchema = optis({
  normalizations: {
    moonfall_hue: parseHue,
  },
})

/** Read the `?moonfall_hue`, the OkHSL hue Moonfall’s theme takes instead of the one its seed rolls, for looking at any of them in any game; `undefined` for none or anything but a whole degree from 0 to 359. */
export function readMoonfallHue(input: URL | string = typeof location === 'undefined' ? '' : location.href): number | undefined {
  return readPermalink(input, {schema: hueSchema}).moonfall_hue
}
