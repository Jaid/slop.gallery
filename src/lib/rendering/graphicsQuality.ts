import useGraphicsMode from 'use-graphics-mode'
import {create} from 'zustand'

import {readCinematicGraphics, readGraphicsMode} from './graphicsMode.ts'

/** a graphics mode by its name, as `?graphics` takes it */
export type GraphicsQuality = ReturnType<typeof useGraphicsMode.getName>

export const graphicsQualities: ReadonlyArray<GraphicsQuality> = [useGraphicsMode.getName(false), useGraphicsMode.getName(true), useGraphicsMode.getName(true, true)]

/** the graphics the page started with: what `?graphics` asks for, `auto` as what it picked for this page’s GPU, or fast without it */
export const initialGraphicsQuality: GraphicsQuality = useGraphicsMode.getName(readGraphicsMode(), readCinematicGraphics())

/** the graphics of this session, which the menu and the `set_graphics_quality` WebMCP tool change and `GraphicsMode` hands to every component */
export const useGraphicsQuality = create<{quality: GraphicsQuality}>(() => ({quality: initialGraphicsQuality}))

/**
 * Whether the page can show the graphics: cinematic ones only where it started with them, as only then its renderer asked the GPU for the limits they need.
 */
export function supportsGraphicsQuality(quality: GraphicsQuality, initial = initialGraphicsQuality) {
  return quality !== useGraphicsMode.getName(true, true) || initial === quality
}

/** The graphics the menu’s switch between fast and heavy means: the page’s own kind of heavy, cinematic where it started with that. */
export function toggledGraphicsQuality(isHeavy: boolean, initial = initialGraphicsQuality): GraphicsQuality {
  return useGraphicsMode.getName(isHeavy, initial === useGraphicsMode.getName(true, true))
}
