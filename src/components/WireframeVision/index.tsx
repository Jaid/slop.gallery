import {useStore, useThree} from '@react-three/fiber'
import {useEffect, useState} from 'react'

import {activateRenderPipeline, releaseRenderPipeline} from '#src/lib/rendering/activeRenderPipeline.ts'
import OverlayWireframePipeline from '#src/lib/rendering/OverlayWireframePipeline.ts'
import {showWireframe} from '#src/lib/rendering/showWireframe.ts'
import viewportLineWidth from '#src/lib/rendering/viewportLineWidth.ts'
import {readWireframeHighlight} from '#src/lib/rendering/wireframeHighlight.ts'

/** Replace the regular frame with a hidden-line wireframe of the scene: classic hardware lines for `?show_wireframe=true`, antialiased edges of the given width in hundredths of a pixel at 1920×1080 for a number. */
const WireframeVision = () => {
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const store = useStore()
  const [highlight] = useState(() => readWireframeHighlight())
  useEffect(() => {
    const pipeline = new OverlayWireframePipeline(renderer, scene, camera, highlight)
    pipeline.angleIndicatorStrength = 1
    const width = showWireframe
    if (typeof width === 'number') {
      pipeline.lineWidth = targetRenderer => viewportLineWidth(targetRenderer, width)
    } else {
      pipeline.lineStyle = 'lines'
    }
    activateRenderPipeline(store, pipeline)
    return () => {
      releaseRenderPipeline(store, pipeline)
      pipeline.dispose()
    }
  }, [camera, highlight, renderer, scene, store])
  return null
}
export default WireframeVision
