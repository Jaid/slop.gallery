import optis from 'optis'
import readPermalink from 'read-permalink'

/** the kinds of openings the Studio’s ceiling may be cut with, in the order seeds roll them by; light enough for the query parameters to list without loading any of them */
export const openingStyleIds = ['rose', 'sunburst', 'lattice', 'honeycomb', 'voronoi', 'louvers', 'perforated', 'constellation', 'girih', 'lancets', 'foils', 'coffers', 'crescent', 'sunflower', 'rings', 'slits'] as const
export type OpeningStyleId = typeof openingStyleIds[number]
/** what the Studio’s design names for a ceiling without openings, a plain slab, which no seed rolls but the world tuning switches to */
export const noOpenings = 'none'
/** the kind of openings a Studio’s ceiling is cut with, or {@link noOpenings} */
export type StudioOpeningsChoice = OpeningStyleId | typeof noOpenings

const isOpeningStyleId = (value: unknown): value is OpeningStyleId => (openingStyleIds as ReadonlyArray<unknown>).includes(value)
const openingsSchema = optis({
  defaults: {
    openings: '',
  },
  normalizations: {
    openings(value: unknown): OpeningStyleId | '' {
      return isOpeningStyleId(value) ? value : ''
    },
  },
})

/** Read the `?openings`, the kind of openings the Studio’s ceiling is cut with in any game, its shapes and sizes still rolled by the seed; empty for the seed’s own kind or an id no kind has. */
export function readOpenings(input: URL | string = typeof location === 'undefined' ? '' : location.href): OpeningStyleId | '' {
  return readPermalink(input, {schema: openingsSchema}).openings
}

/** the kind of openings `?openings` cuts the Studio’s ceiling with, read once at startup, or empty */
export const forcedOpenings = readOpenings()
