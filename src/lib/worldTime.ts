import type {PauseMenuSnapshot} from 'use-pause-menu/core'

import pauseMenu from './pauseMenu.ts'
import WorldClock from './WorldClock.ts'

/** Only Escape’s menu freezes the world. The last stage remains set while locked, so stage alone is insufficient. */
export const freezesWorld = ({locked, stage}: PauseMenuSnapshot) => !locked && stage === 'pause'

const worldTime = new WorldClock
const sync = () => {
  worldTime.paused = freezesWorld(pauseMenu.getSnapshot())
}
sync()
const unsubscribe = pauseMenu.subscribe(sync)
if (import.meta.hot as ImportMeta['hot'] | undefined) {
  import.meta.hot.dispose(unsubscribe)
}

export default worldTime
