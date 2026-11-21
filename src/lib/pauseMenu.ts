import type {PauseMenuSnapshot} from 'use-pause-menu/core'

import optis from 'optis'
import readPermalink from 'read-permalink'
import PauseMenu from 'use-pause-menu/core'

import {isContinuing} from './gameSeed.ts'

const enabledValues = new Set<unknown>([true, '', 'true'])
const pausedSchema = optis({
  defaults: {
    paused: false,
  },
  normalizations: {
    paused(value: unknown) {
      return enabledValues.has(value)
    },
  },
})

/** Read the `?paused` flag that opens the page under the Escape key’s pause menu, whose world freezes as soon as it is ready and finishes loading behind it; a bare `?paused` counts as enabled. */
export function readPaused(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: pausedSchema}).paused
}

/**
 * Whether the menu is up as the pause menu the Escape key brings, which freezes the world behind it (see `gallery/worldPause.ts`). The menu of a lost focus, like the one the Windows key or another tab brings up, and the menus before the game leave the world running.
 */
export function isPausing({locked, stage}: PauseMenuSnapshot) {
  return !locked && stage === 'pause'
}

// A stored seed is the only trace of an earlier visit, so its game can be continued or replaced by a new one.
const pauseMenu = new PauseMenu({initialStage: isContinuing ? 'return' : 'first'})

export default pauseMenu
