import optis from 'optis'
import readPermalink, {parseNumber} from 'read-permalink'

import {parseRatio} from '#src/lib/rendering/ratio.ts'

/** what `?turntable` and its companions ask the Cell to float and turn */
export type TurntableRequest = {
  /** the frame area in cm², or undefined for the default portrait area */
  area: number | undefined
  /** the id of an artwork of the catalog or the URL of an image, empty for the catalog’s first */
  artwork: string
  /** how many times as wide as high the work is, or undefined for its image’s own aspect */
  aspect: number | undefined
}

const disabledValues = new Set<unknown>([false, 'false'])
const turntableSchema = optis({
  normalizations: {
    turntable(value: unknown) {
      if (disabledValues.has(value)) {
        return
      }
      return value === true || value === 'true' ? '' : String(value).trim()
    },
    turntable_area(value: unknown) {
      try {
        const area = parseNumber(value)
        return Number.isFinite(area) && area > 0 ? area : undefined
      } catch {
      }
    },
    turntable_ratio: parseRatio,
  },
})

/**
 * Read the work `?turntable` floats in front of the Cell’s east wall, turning it round once every 12 s, so its frame shows from every side, its back included: an artwork of the catalog by its id, like `?turntable=goose`, an image by its URL, or the catalog’s first for `?turntable` alone; undefined without one or for `?turntable=false`.
 * It wears the frame `?frame` names, or else its own roll of the Cell’s. `?turntable_ratio` sets its width per height, as `3:2`, `3/2` or `1.5`, which crops its image to fit, its catalog ratio or its image’s own aspect by default, and `?turntable_area` its frame area in cm², the default portrait area of 15 000 cm² by default.
 */
export function readTurntable(input: URL | string = typeof location === 'undefined' ? '' : location.href): TurntableRequest | undefined {
  const {turntable, turntable_area: area, turntable_ratio: aspect} = readPermalink(input, {schema: turntableSchema})
  if (turntable === undefined) {
    return
  }
  return {
    artwork: turntable,
    aspect,
    area,
  }
}
