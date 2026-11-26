import type {GraphicsModeName, GraphicsQuality} from './graphicsMode.ts'

import {create} from 'zustand'

import {readStored, writeStored} from '../browserStorage.ts'
import {isHeavyCapable, readHeavyCapabilityHints} from './autoGraphics.ts'
import {graphicsProfiles, parseGraphicsModeName, readGraphicsModeName} from './graphicsMode.ts'

const currentUrl = () => (typeof location === 'undefined' ? '' : location.href)

/** Read the graphics `?graphics` asks for, or undefined where the URL leaves them to the browser storage. A `?graphics` of no known name still asks for fast graphics. */
export function readGraphicsOverride(input: URL | string = currentUrl()): GraphicsModeName | undefined {
  const url = new URL(input, 'http://localhost/')
  return url.searchParams.has('graphics') ? readGraphicsModeName(input) : undefined
}

/** Read the graphics the menu stored for the pages to come, if any. */
export function readStoredGraphics(): GraphicsModeName | undefined {
  return parseGraphicsModeName(readStored('graphics'))
}

/** Read the graphics a page asks for: `?graphics`, else the ones the menu stored, else fast. */
export function readRequestedGraphics(input: URL | string = currentUrl()): GraphicsModeName {
  return readGraphicsOverride(input) ?? readStoredGraphics() ?? 'fast'
}

/** the graphics this page asks for, read once at startup */
export const requestedGraphics = readRequestedGraphics()

/**
 * The graphics of this page, `auto` as what it picked for this page’s GPU. They stay the same for the whole page: the menu only changes the graphics of the pages to come.
 * Only `auto` waits for the adapter, before anything reads the graphics.
 */
export const graphicsQuality: GraphicsQuality = requestedGraphics === 'auto' ? (isHeavyCapable(await readHeavyCapabilityHints()) ? 'heavy' : 'fast') : requestedGraphics
/** the budget of this page’s graphics */
export const graphicsProfile = graphicsProfiles[graphicsQuality]
/** whether this page renders heavy graphics, which cinematic graphics are too */
export const isHeavyGraphics = graphicsQuality !== 'fast'
/** whether this page renders cinematic graphics: heavy, but budgeted for non-realtime rendering */
export const isCinematicGraphics = graphicsQuality === 'cinematic'

/** the graphics the next page starts with, which the menu shows: this page’s until the menu switches them */
export const useNextGraphics = create<{quality: GraphicsQuality}>(() => ({quality: graphicsQuality}))

/** how the pages to come get other graphics, which {@link planGraphicsChange} decides and {@link applyGraphicsChange} carries out */
export type GraphicsChange = {
  quality: GraphicsQuality
} & ({
  /** the URL the page goes to */
  url: string
  /** `url`: the page has `?graphics`, so it goes to the same URL with the graphics in its place, leaving the stored graphics alone; `storage`: the graphics are stored for the next page, and this one keeps its own */
  via: 'url'
} | {via: 'storage'})

/** The graphics the menu’s switch goes to from `quality`: fast from heavy and cinematic, heavy from fast. */
export function toggledGraphicsQuality(quality: GraphicsQuality): GraphicsQuality {
  return quality === 'fast' ? 'heavy' : 'fast'
}

/** How the pages to come would get `quality`, without doing anything yet. */
export function planGraphicsChange(quality: GraphicsQuality, input: URL | string = currentUrl()): GraphicsChange {
  if (readGraphicsOverride(input) !== undefined) {
    const url = new URL(input, 'http://localhost/')
    url.searchParams.set('graphics', quality)
    return {
      via: 'url',
      url: url.href,
      quality,
    }
  }
  return {
    via: 'storage',
    quality,
  }
}

/** Carries out a change {@link planGraphicsChange} decided on: goes to its URL, or stores the graphics for the next page. Returns whether that worked, which blocked storage keeps from happening. */
export function applyGraphicsChange(change: GraphicsChange) {
  if (change.via === 'url') {
    location.assign(change.url)
    return true
  }
  if (!writeStored('graphics', change.quality)) {
    return false
  }
  useNextGraphics.setState({quality: change.quality})
  return true
}
