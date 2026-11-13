import type {PauseMenuSnapshot} from 'use-pause-menu/core'

import PauseMenu from 'use-pause-menu/core'

import {isContinuing} from './gameSeed.ts'

// A stored seed is the only trace of an earlier visit, so its game can be continued or replaced by a new one.
const pauseMenu = new PauseMenu({initialStage: isContinuing ? 'return' : 'first'})

/** Whether the Escape-key pause menu is currently open, which freezes the world, stops rendering new frames and pauses audio. */
export function isPauseFrozen({locked, stage}: Pick<PauseMenuSnapshot, 'locked' | 'stage'> = pauseMenu.getSnapshot()): boolean {
  return !locked && stage === 'pause'
}

export default pauseMenu
