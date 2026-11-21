// Stale chunks must be handled before the world loads, which may already find the previous build’s chunks gone, and the node time has to follow the world’s clock before any renderer updates it.
import './lib/staleChunks.ts'
import './lib/rendering/nodeTime.ts'
import './style.sass'

import mountRoot from 'mount-root'

import App from '#component/App'

import {applySpawnBookmark} from './lib/gallery/bookmarks.ts'
import freezeWhilePaused from './lib/gallery/worldPause.ts'
import pauseMenu, {readPaused} from './lib/pauseMenu.ts'
import {currentWorldInfo} from './worlds/index.ts'

import css from './style.module.sass'

document.title = currentWorldInfo.title
pauseMenu.start()
// Under ?paused, the first menu is already the pause menu’s, like after Escape, without waiting for the world to load.
if (readPaused()) {
  pauseMenu.pause()
}
// Before anything else follows the menu, so whatever does finds the world already frozen, or going on again.
freezeWhilePaused()
applySpawnBookmark()
mountRoot(App, {
  id: css.container,
  strict: import.meta.env.DEV,
})
