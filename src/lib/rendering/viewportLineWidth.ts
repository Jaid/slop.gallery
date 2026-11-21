import type {Renderer} from 'three/webgpu'

import {Vector4} from 'three/webgpu'

const canvasViewport = new Vector4
/** Convert hundredths of a pixel at 1920×1080 to pixels in the current render viewport, including offscreen captures. */
export default function viewportLineWidth(renderer: Renderer, width: number) {
  const target = renderer.getRenderTarget()
  const viewport = target?.viewport ?? renderer.getViewport(canvasViewport)
  // Canvas viewport dimensions are logical pixels; render targets already use physical pixels.
  const pixelRatio = target ? 1 : renderer.getPixelRatio()
  return width / 100 * Math.sqrt(viewport.z * viewport.w / (1920 * 1080)) * pixelRatio
}
