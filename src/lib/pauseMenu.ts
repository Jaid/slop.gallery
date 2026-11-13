import type {PauseMenuStage} from 'use-pause-menu/core'

import PauseMenu from 'use-pause-menu/core'

import {isContinuing} from './gameSeed.ts'

/** Whether the Escape-key pause menu is active: all world updates and audio should stop while the menu sits over the scene. */
export function shouldFreezeWorld(stage: PauseMenuStage | undefined) {
  return stage === 'pause'
}

// A stored seed is the only trace of an earlier visit, so its game can be continued or replaced by a new one.
const pauseMenu = new PauseMenu({initialStage: isContinuing ? 'return' : 'first'})

export default pauseMenu
