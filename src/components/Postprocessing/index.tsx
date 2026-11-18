import type {RenderPipelineSettings, RenderPipelineStructure} from '#src/lib/rendering/renderPipelineSettings.ts'

import {useStore, useThree} from '@react-three/fiber'
import {useLayoutEffect, useMemo} from 'react'
import {PerspectiveCamera} from 'three/webgpu'
import {useShallow} from 'zustand/react/shallow'

import {galleryEvents} from '#src/lib/gallery/actions.ts'
import {getSunReach} from '#src/lib/gallery/sunReach.ts'
import {activateRenderPipeline, releaseRenderPipeline} from '#src/lib/rendering/activeRenderPipeline.ts'
import {useCustomGraphics} from '#src/lib/rendering/customGraphics.ts'
import GalleryRenderPipeline from '#src/lib/rendering/GalleryRenderPipeline.ts'
import {moodScreenActive, subscribeMoodScreen} from '#src/lib/rendering/moodScreen.ts'
import {getInspectionFocus, getInspectionFocusBlur, getInspectionFocusDistance, getInspectionFocusProximity, getPlayerZoom} from '#src/lib/rendering/playerView.ts'
import {getRenderPipelineStructure} from '#src/lib/rendering/renderPipelineSettings.ts'
import TunableRenderPipeline from '#src/lib/rendering/TunableRenderPipeline.ts'

type PostprocessingProps = {
  /** whether V-viewing blurs the background */
  focus?: boolean
  heavy?: boolean
  /** the graphics mode’s pipeline */
  settings: RenderPipelineSettings
  /** whether the tuning panel of `?development` can change the pipeline */
  tunable?: boolean
}

const Postprocessing = ({focus = false, heavy = true, settings, tunable = false}: PostprocessingProps) => {
  const renderer = useThree(state => state.renderer)
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const store = useStore()
  const panelStructure = useCustomGraphics(useShallow(getRenderPipelineStructure))
  // Compared by value, so a panel change only rebuilds the pipeline when it changes its passes.
  const structureKey = JSON.stringify(tunable ? panelStructure : getRenderPipelineStructure(settings))
  const structure = useMemo(() => JSON.parse(structureKey) as RenderPipelineStructure, [structureKey])
  // The tuning panel’s view. The camera’s zoom treats a new field of view as the one to zoom from and return to.
  const fov = useCustomGraphics(state => state.fov)
  const toneMapping = useCustomGraphics(state => state.toneMapping)
  useLayoutEffect(() => {
    if (tunable && camera instanceof PerspectiveCamera && camera.fov !== fov) {
      // eslint-disable-next-line react-hooks/immutability -- the panel owns the camera’s field of view while tuning.
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [camera, fov, tunable])
  useLayoutEffect(() => {
    if (tunable) {
      // A render pipeline notices a new tone mapping and rebuilds its output by itself.
      // eslint-disable-next-line react-hooks/immutability -- the panel owns the renderer’s tone mapping while tuning.
      renderer.toneMapping = toneMapping as typeof renderer.toneMapping
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
    // Antialiasing has to run every frame; otherwise a light pipeline only takes over during inspection focus.
    const isPersistent = heavy || structure.antiAliasing !== false
    const activate = () => {
      activateRenderPipeline(store, pipeline)
    }
    const deactivate = () => {
      releaseRenderPipeline(store, pipeline)
    }
    let active = false
    const sync = () => {
      const needed = isPersistent || moodScreenActive() || focus && getInspectionFocus() > 0
      if (needed === active) {
        return
      }
      active = needed
      if (needed) {
        activate()
      } else {
        deactivate()
      }
    }
    sync()
    const stopWatchingScreens = isPersistent ? undefined : subscribeMoodScreen(sync)
    if (!isPersistent && focus) {
      galleryEvents.addEventListener('inspection-focus-start', sync)
      galleryEvents.addEventListener('inspection-focus-end', sync)
    }
    return () => {
      stopWatchingScreens?.()
      if (!isPersistent && focus) {
        galleryEvents.removeEventListener('inspection-focus-start', sync)
        galleryEvents.removeEventListener('inspection-focus-end', sync)
      }
      deactivate()
      pipeline.dispose()
    }
  }, [camera, focus, heavy, renderer, scene, settings, store, structure, tunable])
  return null
}
export default Postprocessing
