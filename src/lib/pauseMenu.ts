import type {PauseMenuSnapshot} from 'use-pause-menu/core'

import PauseMenu from 'use-pause-menu/core'

import {isContinuing} from './gameSeed.ts'

/**
 * Whether the menu is up as the pause menu the Escape key brings, which freezes the world behind it (see `gallery/worldPause.ts`). The menu of a lost focus, like the one the Windows key or another tab brings up, and the menus before the game leave the world running.
 */
export function isPausing({locked, stage}: PauseMenuSnapshot) {
  return !locked && stage === 'pause'
}

// A stored seed is the only trace of an earlier visit, so its game can be continued or replaced by a new one.
const pauseMenu = new PauseMenu({initialStage: isContinuing ? 'return' : 'first'})

export default pauseMenu
