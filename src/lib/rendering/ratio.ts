import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'

/** A width-to-height ratio given as `16:9`, `16/9` or `1.78`; undefined for anything else. */
export function parseRatio(value: unknown) {
  const sides = typeof value === 'string' ? value.split(/[/:]/) : [value]
  if (sides.length > 2) {
    return
  }
  try {
    const [width, height = 1] = sides.map(parseNumber)
    const ratio = width / height
    if (width > 0 && height > 0 && ratio > 0 && Number.isFinite(ratio)) {
      return ratio
    }
  } catch {
  }
}
const ratioSchema = optis({
  normalizations: {
    ratio: parseRatio,
  },
})

/** Read an optional width-to-height ratio for the canvas from the permalink, given as `16:9`, `16/9` or `1.78`; `undefined` lets the canvas fill the page. */
export function readRatio(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  return readPermalink(input, {schema: ratioSchema}).ratio
}

/** the width-to-height ratio this page was opened with through `?ratio`, read once at startup */
export const screenRatio = readRatio()
