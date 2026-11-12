import type {ReactCanvasTextureRecipe} from 'canvas-textures/react'
import type {ReactNode} from 'react'

import rasterizeElements from 'rasterize-element'
import renderElement from 'rasterize-element/react'
import {useMemo} from 'react'

import fitLines, {hasFittedLines} from './fitLines.ts'
import useLoadingCanvasTexture from './useLoadingCanvasTexture.ts'

/** A texture whose face is HTML: `render` gives a node of `width` × `height` CSS pixels, which the browser lays out with the page’s style sheets. */
export type ElementTextureRecipe<T = undefined> = Omit<ReactCanvasTextureRecipe<HTMLCanvasElement>, 'disposeInputs' | 'draw' | 'prepare'> & {
  /** Release what `prepare` made once the face is rasterized or given up. */
  disposeInputs?: (inputs: T) => void
  /** Resolve what the face needs that is not HTML, like rendered canvases. Fonts and images of the face are waited for anyway. */
  prepare?: (signal: AbortSignal) => Promise<T>
  render: (inputs: T) => ReactNode
}

/** Rasterizes a face of React DOM and hands it over as a canvas, with lines marked by `fitted` shrunk to fit. */
export async function rasterizeFace(node: ReactNode, {width, height, resolution}: {
  height: number
  resolution?: number
  width: number
}, signal?: AbortSignal) {
  using face = renderElement(node)
  return await rasterizeElements({
    width,
    height,
    resolution,
    signal,
    elements: [face.element],
    arrange: hasFittedLines(face.element) ? () => fitLines(face.element) : undefined,
  })
}

/** {@link useLoadingCanvasTexture} for a face of HTML. Memoize the recipe: its identity is the texture’s. */
export default function useLoadingElementTexture<T = undefined>(id: string, recipe: ElementTextureRecipe<T>) {
  return useLoadingCanvasTexture(id, useMemo((): ReactCanvasTextureRecipe<HTMLCanvasElement> => {
    const {prepare, render, disposeInputs, ...raster} = recipe
    return {
      ...raster,
      async prepare(signal) {
        // Awaited even without inputs, since React DOM only renders a face right away outside of a renderer’s effects.
        const inputs = await prepare?.(signal) as T
        try {
          return await rasterizeFace(render(inputs), raster, signal)
        } finally {
          disposeInputs?.(inputs)
        }
      },
      draw: (context, face) => context.drawImage(face, 0, 0, raster.width, raster.height),
      disposeInputs(face) {
        face.width = 0
      },
    }
  }, [recipe]))
}
