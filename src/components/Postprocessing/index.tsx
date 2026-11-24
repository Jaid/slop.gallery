import type {RenderPipelineSettings} from '#src/lib/rendering/renderPipelineSettings.ts'

import {useStore, useThree} from '@react-three/fiber'
import {useLayoutEffect} from 'react'
import {useShallow} from 'zustand/react/shallow'

import {getSunReach} from '#src/lib/gallery/sunReach.ts'
import {activateRenderPipeline, releaseRenderPipeline} from '#src/lib/rendering/activeRenderPipeline.ts'
import GalleryRenderPipeline from '#src/lib/rendering/GalleryRenderPipeline.ts'
import {getInspectionFocus, getInspectionFocusBlur, getInspectionFocusDistance, getInspectionFocusProximity, getPlayerZoom} from '#src/lib/rendering/playerView.ts'
import {getRenderPipelineStructure} from '#src/lib/rendering/renderPipelineSettings.ts'
import TunableRenderPipeline from '#src/lib/rendering/TunableRenderPipeline.ts'
import {pipelineTuning} from '#src/lib/worldTuning/PipelineTuningModule.ts'
import {toneMappings, viewTuning} from '#src/lib/worldTuning/ViewTuningModule.ts'

type PostprocessingProps = {
  /** whether V-viewing blurs the background */
  focus?: boolean
  heavy?: boolean
  /** the graphics mode’s pipeline */
  settings: RenderPipelineSettings
  /** whether the world tuning of `?development` can change the pipeline */
  tunable?: boolean
}

const Postprocessing = ({focus = false, heavy = true, settings, tunable = false}: PostprocessingProps) => {
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const store = useStore()
  const panelStructure = pipelineTuning.useValues(useShallow(getRenderPipelineStructure))
  // Compared by value, so a panel change only rebuilds the pipeline when it changes its passes.
  const structureKey = JSON.stringify(tunable ? panelStructure : getRenderPipelineStructure(settings))
  // The world tuning’s tone mapping. Its field of view reaches the camera through `TunedFov`, in every graphics mode.
  const toneMapping = toneMappings[viewTuning.useValues(state => state.toneMapping)]
  useLayoutEffect(() => {
    if (tunable) {
      // A render pipeline notices a new tone mapping and rebuilds its output by itself.
      // eslint-disable-next-line react-hooks/immutability -- the world tuning owns the renderer’s tone mapping while tuning.
      renderer.toneMapping = toneMapping
    }
  }, [renderer, toneMapping, tunable])
  // The scene pass renders into targets with their own outputs. Activated after the first frame, every material of the scene would build a second time for them. The world’s scene suspends the canvas until it is in, so the pipeline finds its sun.
  useLayoutEffect(() => {
    const options = {
      heavy,
      volumetricLightReach: getSunReach,
      zoom: getPlayerZoom,
      focus: focus ? {
        amount: getInspectionFocus,
        blur: getInspectionFocusBlur,
        distance: getInspectionFocusDistance,
        proximity: getInspectionFocusProximity,
      } : undefined,
    }
    const pipeline = tunable ? new TunableRenderPipeline(renderer, scene, camera, options) : new GalleryRenderPipeline(renderer, scene, camera, {
      ...options,
      settings,
    })
    activateRenderPipeline(store, pipeline)
    return () => {
      releaseRenderPipeline(store, pipeline)
      pipeline.dispose()
    }
  }, [camera, focus, heavy, renderer, scene, settings, store, structureKey, tunable])
  return null
}
export default Postprocessing
