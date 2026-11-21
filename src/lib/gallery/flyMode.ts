import optis from 'optis'
import readPermalink from 'read-permalink'

import isFlagOn from '#src/lib/permalinkFlag.ts'

import {readDevelopmentMode} from '../developmentMode.ts'

const flyingSchema = optis({
  defaults: {
    flying: false,
  },
  normalizations: {
    flying(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** key that toggles the free-flying camera with `?development` */
export const flyModeKey = 'KeyF'

/** Read the `?flying` flag that starts the player flying; a bare `?flying` counts as enabled. Without `?development`, it is ignored. */
export function readFlying(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readDevelopmentMode(input) && readPermalink(input, {schema: flyingSchema}).flying
}

/** Whether the player flies, read by the Player without a React subscription; starts from `?flying`, and a `?spawn` camera bookmark or `flyPlayer` starts it too. */
export const flyMode = {active: readFlying()}

/** Starts or stops flying, returning whether the player flies now. */
export function toggleFlyMode() {
  flyMode.active = !flyMode.active
  return flyMode.active
}
