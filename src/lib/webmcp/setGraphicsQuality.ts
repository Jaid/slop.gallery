import type {GraphicsQuality} from '#src/lib/rendering/graphicsQuality.ts'

import {graphicsQualities, initialGraphicsQuality, supportsGraphicsQuality, useGraphicsQuality} from '#src/lib/rendering/graphicsQuality.ts'

export type GraphicsQualityInput = {
  /** the graphics to switch to, `fast`, `heavy` or `cinematic`, or null for the ones the page started with */
  quality: string | null
}
export type GraphicsQualityChange = {
  /** the graphics the page started with, which null switches back to */
  initial: GraphicsQuality
  /** the graphics before the switch */
  previous: GraphicsQuality
  /** the graphics from now on */
  quality: GraphicsQuality
}

/** Switches the session’s graphics like the menu does, to any of them by name, or with null back to the ones the page started with; see the `set_graphics_quality` tool. */
export default function setGraphicsQuality({quality: name}: GraphicsQualityInput): GraphicsQualityChange {
  const quality = name === null ? initialGraphicsQuality : graphicsQualities.find(candidate => candidate === name)
  if (!quality) {
    throw new Error(`There are no “${name}” graphics. Graphics: ${graphicsQualities.join(', ')}.`)
  }
  if (!supportsGraphicsQuality(quality)) {
    throw new Error(`Only a page opened with ?graphics=${quality} can show ${quality} graphics, as its renderer asks the GPU for their limits when it starts. This page started with ${initialGraphicsQuality} graphics.`)
  }
  const {quality: previous} = useGraphicsQuality.getState()
  useGraphicsQuality.setState({quality})
  return {
    quality,
    previous,
    initial: initialGraphicsQuality,
  }
}
