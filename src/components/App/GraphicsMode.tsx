import type {ReactNode} from 'react'

import {GraphicsModeProvider} from 'use-graphics-mode'

import {toggledGraphicsQuality, useGraphicsQuality} from '#src/lib/rendering/graphicsQuality.ts'

const setIsHeavy = (isHeavy: boolean) => useGraphicsQuality.setState({quality: toggledGraphicsQuality(isHeavy)})

/** Hands the session’s graphics to every component: seeded from the permalink, then changed by the menu and by the `set_graphics_quality` WebMCP tool, local to this session. Cinematic graphics only come from the permalink and return whenever the menu switches back to heavy. */
export default function GraphicsMode({children}: {children: ReactNode}) {
  const quality = useGraphicsQuality(state => state.quality)
  return <GraphicsModeProvider isCinematic={quality === 'cinematic'} isHeavy={quality !== 'fast'} onChange={setIsHeavy}>{children}</GraphicsModeProvider>
}
