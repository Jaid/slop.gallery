import type {RenderPipelineStructure} from '#src/lib/rendering/renderPipelineSettings.ts'

import {useStore, useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'
import {useShallow} from 'zustand/react/shallow'

import {isDevelopmentMode} from '#src/lib/developmentMode.ts'
import {getSunReach} from '#src/lib/gallery/sunReach.ts'
import {activateRenderPipeline, releaseRenderPipeline} from '#src/lib/rendering/activeRenderPipeline.ts'
import GalleryRenderPipeline from '#src/lib/rendering/GalleryRenderPipeline.ts'
import {graphicsProfile, isHeavy} from '#src/lib/rendering/graphicsMode.ts'
import {getInspectionFocus, getInspectionFocusBlur, getInspectionFocusDistance, getInspectionFocusProximity, getPlayerZoom} from '#src/lib/rendering/playerView.ts'
import {getRenderPipelineStructure, renderPipelineSettings} from '#src/lib/rendering/renderPipelineSettings.ts'
import TunableRenderPipeline from '#src/lib/rendering/TunableRenderPipeline.ts'
import {pipelineTuning} from '#src/lib/worldTuning/PipelineTuningModule.ts'
import {toneMappings, viewTuning} from '#src/lib/worldTuning/ViewTuningModule.ts'

const {postprocessing: heavy} = graphicsProfile
const options = {
  heavy,
  volumetricLightReach: getSunReach,
  zoom: getPlayerZoom,
  focus: heavy ? {
    amount: getInspectionFocus,
    blur: getInspectionFocusBlur,
    distance: getInspectionFocusDistance,
    proximity: getInspectionFocusProximity,
  } : undefined,
}
function usePipeline(structure?: RenderPipelineStructure) {
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const store = useStore()
  // The scene pass renders into targets with their own outputs. Activated after the first frame, every material of the scene would build a second time for them. The world’s scene suspends the canvas until it is in, so the pipeline finds its sun.
  useLayoutEffect(() => {
    const pipeline = structure ? new TunableRenderPipeline(renderer, scene, camera, options) : new GalleryRenderPipeline(renderer, scene, camera, {
      ...options,
      settings: renderPipelineSettings,
    })
    activateRenderPipeline(store, pipeline)
    return () => {
      releaseRenderPipeline(store, pipeline)
      pipeline.dispose()
    }
  }, [camera, renderer, scene, store, structure])
}
function FixedPipeline() {
  usePipeline()
  return null
}
function TunedPipeline() {
  const renderer = useThree(state => state.renderer)
  const toneMapping = toneMappings[viewTuning.useValues(state => state.toneMapping)]
  useLayoutEffect(() => {
    // A render pipeline notices a new tone mapping and rebuilds its output by itself.
    // eslint-disable-next-line react-hooks/immutability -- the world tuning owns the renderer’s tone mapping while tuning.
    renderer.toneMapping = toneMapping
  }, [renderer, toneMapping])
  // Only a structural edit rebuilds the pipeline. The existing passes follow uniform edits themselves.
  const structure = pipelineTuning.useValues(useShallow(getRenderPipelineStructure))
  usePipeline(structure)
  return null
}

export default isDevelopmentMode && isHeavy ? TunedPipeline : FixedPipeline
