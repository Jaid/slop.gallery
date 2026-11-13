import type {WorldClock} from '../worldClock.ts'
import type PauseMenu from 'use-pause-menu/core'

import pauseMenu, {isPausing} from '../pauseMenu.ts'
import worldClock from '../worldClock.ts'
import {useGallery} from './store.ts'

/** what tells whether the world has loaded, like the gallery’s store */
type Readiness = {
  getState: () => {ready: boolean}
  subscribe: (listener: () => void) => () => void
}

/**
 * Freezes the clock of the world for as long as the menu is the Escape key’s pause menu (see `isPausing`), which stops the world’s frames, physics, animations and sound until the player resumes. The menu of a lost focus leaves the world running.
 * A world that isn’t ready, like one mounting anew behind the menu, runs until it is, since it only loads by drawing frames and the menu only lets the player back in once it has.
 * Follow the menu before anything else does, so whatever reacts to the menu coming up, like its sound, finds the world already frozen. Returns how to stop following, which lets the world go on.
 */
export default function freezeWhilePaused(menu: Pick<PauseMenu, 'getSnapshot' | 'subscribe'> = pauseMenu, clock: WorldClock = worldClock, gallery: Readiness = useGallery) {
  let release: (() => void) | undefined
  const follow = () => {
    if (isPausing(menu.getSnapshot()) && gallery.getState().ready) {
      release ??= clock.freeze()
    } else {
      release?.()
      release = undefined
    }
  }
  const unsubscribers = [menu.subscribe(follow), gallery.subscribe(follow)]
  follow()
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
    release?.()
    release = undefined
  }
}
