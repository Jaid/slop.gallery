import optis from 'optis'
import readPermalink from 'read-permalink'

import isFlagOn from '#src/lib/permalinkFlag.ts'

const albedoSchema = optis({
  defaults: {
    albedo: false,
  },
  normalizations: {
    albedo(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** Read the `?albedo` flag that renders every surface in its own unlit color instead of its regular look; a bare `?albedo` counts as enabled. */
export function readAlbedo(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: albedoSchema}).albedo
}

/** whether this page was opened with `?albedo`, read once at startup */
export const isShowingAlbedo = readAlbedo()
