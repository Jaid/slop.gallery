import type {GalleryRenderPipelineOptions} from './GalleryRenderPipeline.ts'
import type {Camera, Object3D, Renderer} from 'three/webgpu'

import {pipelineTuning} from '../worldTuning/PipelineTuningModule.ts'
import GalleryRenderPipeline from './GalleryRenderPipeline.ts'

/** The gallery pipeline of `?development`, built from the world tuning’s values, which stay after hiding its panel, and following their uniforms live. */
export default class TunableRenderPipeline extends GalleryRenderPipeline {
  private readonly unsubscribe: () => void

  constructor(renderer: Renderer, scene: Object3D, camera: Camera, options: Omit<GalleryRenderPipelineOptions, 'settings'>) {
    super(renderer, scene, camera, {
      ...options,
      settings: pipelineTuning.get(),
    })
    this.unsubscribe = pipelineTuning.subscribe(settings => {
      for (const [node, key] of this.uniforms) {
        node.value = settings[key]
      }
    })
  }

  override dispose() {
    this.unsubscribe()
    super.dispose()
  }
}
