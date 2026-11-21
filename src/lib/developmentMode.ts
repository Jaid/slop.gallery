import optis from 'optis'
import readPermalink from 'read-permalink'

import isFlagOn from '#src/lib/permalinkFlag.ts'

const developmentModeSchema = optis({
  defaults: {
    development: false,
  },
  normalizations: {
    development(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** Read the `?development` diagnostics flag; a bare `?development` counts as enabled. */
export function readDevelopmentMode(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: developmentModeSchema}).development
}

/** whether this page was opened with `?development`, read once at startup */
export const isDevelopmentMode = readDevelopmentMode()
