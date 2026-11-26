import type {GraphicsQuality} from '../../../src/lib/rendering/graphicsMode.ts'

import {mock} from 'bun:test'

import {graphicsProfiles} from '../../../src/lib/rendering/graphicsMode.ts'
import * as pageGraphics from '../../../src/lib/rendering/graphicsQuality.ts'

const modulePath = Bun.fileURLToPath(new URL('../../../src/lib/rendering/graphicsQuality.ts', import.meta.url))
const original = {...pageGraphics}

/**
 * Has every module that reads this page’s graphics read `quality` instead, as a page opened with them would, until disposed. Tests run without a URL or storage, so the page’s own graphics are fast.
 * Modules read the graphics as live bindings, so components render with them from now on; what a module derived from them as it loaded keeps the page’s own.
 */
export async function mockPageGraphics(quality: GraphicsQuality) {
  await mock.module(modulePath, () => ({
    ...original,
    graphicsQuality: quality,
    graphicsProfile: graphicsProfiles[quality],
    isHeavyGraphics: quality !== 'fast',
    isCinematicGraphics: quality === 'cinematic',
  }))
  return {
    async [Symbol.asyncDispose]() {
      await mock.module(modulePath, () => original)
    },
  }
}
