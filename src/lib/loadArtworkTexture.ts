import renderCanvasTexture from 'canvas-textures/three'

import decodeImage from './gallery/decodeImage.ts'
import {maximumArtworkEdge} from './gallery/imagePolicy.ts'

/** URL loads can fail while the dev server restarts; never permanently cache that failure. */
export default async function loadArtworkTexture(source: Blob | string, retryDelay = 500) {
  const attempts = typeof source === 'string' ? 3 : 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = typeof source === 'string' ? await fetch(source, {signal: AbortSignal.timeout(20_000)}) : null
      if (response && !response.ok && typeof source === 'string') {
        throw new Error(`Artwork image HTTP ${response.status}: ${source}`)
      }
      const decoded = await decodeImage(response ? await response.blob() : source as Blob)
      try {
        const fit = maximumArtworkEdge / Math.max(decoded.width, decoded.height)
        const scale = decoded.vector ? fit : Math.min(1, fit)
        const width = Math.max(1, Math.round(decoded.width * scale))
        const height = Math.max(1, Math.round(decoded.height * scale))
        return renderCanvasTexture({
          width,
          height,
          draw: context => context.drawImage(decoded.source, 0, 0, width, height),
        })
      } finally {
        decoded.close()
      }
    } catch (error) {
      if (attempt === attempts - 1) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay * 2 ** attempt))
    }
  }
  throw new Error('Artwork texture could not be loaded.')
}
