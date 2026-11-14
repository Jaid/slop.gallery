// Stale chunks must be handled before the world loads, which may already find the previous build’s chunks gone, and the node time has to follow the world’s clock before any renderer updates it.
import './lib/staleChunks.ts'
import './lib/rendering/nodeTime.ts'
import './style.sass'

import mountRoot from 'mount-root'

import App from '#component/App'

import {applySpawnBookmark} from './lib/gallery/bookmarks.ts'
import freezeWhilePaused from './lib/gallery/worldPause.ts'
import pauseMenu from './lib/pauseMenu.ts'

import css from './style.module.sass'

pauseMenu.start()
// Before anything else follows the menu, so whatever does finds the world already frozen, or going on again.
freezeWhilePaused()
applySpawnBookmark()
mountRoot(App, {
  id: css.container,
  strict: import.meta.env.DEV,
})
