import type {Camera, Renderer, Scene} from 'three/webgpu'

import {WireframeRenderPipeline} from 'capture-session'
import {texture} from 'three/tsl'
import {DepthTexture, HalfFloatType, RenderPipeline, RenderTarget, Vector2} from 'three/webgpu'

import overlay from '../overlay/index.ts'

/** Wireframe normally draws straight to the output. Only when a stroke needs its depth, keep the same single world render in a sampleable target. */
export default class OverlayWireframePipeline extends WireframeRenderPipeline {
  wireframeTarget?: RenderTarget
  private outputPass?: RenderPipeline
  private readonly size = new Vector2
  constructor(renderer: Renderer, scene: Scene, private readonly view: Camera, highlight: Array<string> | string = []) {
    super(renderer, scene, view, highlight)
  }
  override dispose() {
    this.outputPass?.dispose()
    this.wireframeTarget?.dispose()
    super.dispose()
  }
  override render() {
    if (!overlay.needsDepth(this.view)) {
      super.render()
      return
    }
    const {renderer} = this
    const size = renderer.getDrawingBufferSize(this.size)
    this.wireframeTarget ??= new RenderTarget(size.x, size.y, {
      type: HalfFloatType,
      depthTexture: new DepthTexture(size.x, size.y),
    })
    this.wireframeTarget.setSize(size.x, size.y)
    this.outputPass ??= new RenderPipeline(renderer, texture(this.wireframeTarget.texture))
    const previous = renderer.getRenderTarget()
    try {
      renderer.setRenderTarget(this.wireframeTarget)
      super.render()
    } finally {
      renderer.setRenderTarget(previous)
    }
    this.outputPass.render()
  }
}
