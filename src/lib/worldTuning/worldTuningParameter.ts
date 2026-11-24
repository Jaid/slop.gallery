import optis from 'optis'
import readPermalink from 'read-permalink'

import {readDevelopmentMode} from '#src/lib/developmentMode.ts'
import isFlagOn from '#src/lib/permalinkFlag.ts'

const worldTuningSchema = optis({
  defaults: {
    world_tuning: false,
  },
  normalizations: {
    world_tuning(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** Read the `?world_tuning` flag that starts the page with the world tuning panel shown; a bare `?world_tuning` counts as enabled. Without `?development`, which the panel needs, it is ignored. */
export function readWorldTuning(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readDevelopmentMode(input) && readPermalink(input, {schema: worldTuningSchema}).world_tuning
}
