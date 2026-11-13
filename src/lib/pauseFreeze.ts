import {narrator} from './audio/narration.ts'
import SoundEngine from './audio/SoundEngine.ts'
import {setWorldClockPaused} from './frozenTime.ts'
import pauseMenu, {isPauseFrozen} from './pauseMenu.ts'

/** Applies the Escape-key pause freeze state to the world clock, audio engine and narrator. */
export function applyPauseFreeze(frozen = isPauseFrozen()) {
  setWorldClockPaused(frozen)
  SoundEngine.existing()?.setPaused(frozen)
  narrator.paused = frozen
}

/** Keeps the world clock, audio engine and narrator frozen while the Escape pause menu is open, and returns the cleanup. */
export function attachPauseFreeze() {
  applyPauseFreeze()
  const unsubscribe = pauseMenu.subscribe(() => applyPauseFreeze())
  return () => {
    unsubscribe()
    applyPauseFreeze(false)
  }
}
