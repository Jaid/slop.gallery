import type {GraphicsQuality} from './graphicsMode.ts'

import {create} from 'zustand'

import {writeStored} from '#src/lib/browserStorage.ts'

import {graphicsQuality, readGraphicsOverride} from './graphicsMode.ts'

export type {GraphicsQuality} from './graphicsMode.ts'
export {graphicsQualities} from './graphicsMode.ts'

/** the graphics quality shown by the menu button: starts as this session’s quality, and updates when toggled without a `?graphics` URL override so the next reload picks it up */
export const useSelectedGraphics = create<{quality: GraphicsQuality}>(() => ({quality: graphicsQuality}))

/** how the menu’s Graphics button carries out a toggle */
export type GraphicsChange = {
  /** the preset shown before the toggle */
  previous: GraphicsQuality
  /** the preset chosen for the next load */
  quality: GraphicsQuality
} & ({
  /** the URL the page goes to */
  url: string
  /** `url`: the page overrides graphics via URL parameter, so it navigates to the new `?graphics` URL without touching browser storage; `storage`: browser storage is updated for the next reload and the current session stays untouched */
  via: 'url'
} | {via: 'storage'})

/** Plans toggling graphics between fast and heavy without changing storage or navigating yet. */
export function planGraphicsToggle(current = useSelectedGraphics.getState().quality, href = location.href): GraphicsChange {
  const quality: GraphicsQuality = current === 'fast' ? 'heavy' : 'fast'
  if (readGraphicsOverride(href) !== undefined) {
    const url = new URL(href)
    url.searchParams.set('graphics', quality)
    return {
      via: 'url',
      url: url.href,
      previous: current,
      quality,
    }
  }
  return {
    via: 'storage',
    previous: current,
    quality,
  }
}

/** Carries out a planned graphics change: navigates for URL overrides, or updates localStorage and the menu label for the next reload. */
export function applyGraphicsChange(change: GraphicsChange) {
  if (change.via === 'url') {
    location.assign(change.url)
    return
  }
  writeStored('graphics', change.quality)
  useSelectedGraphics.setState({quality: change.quality})
}

/** Handles clicking the menu’s Graphics button. */
export function toggleGraphicsQuality() {
  applyGraphicsChange(planGraphicsToggle())
}
