import type {Renderer} from 'three/webgpu'

import {Vector4} from 'three/webgpu'

const canvasViewport = new Vector4
/** Convert hundredths of a pixel at a 1080 px short edge to pixels in the current render viewport, including offscreen captures. */
export default function viewportLineWidth(renderer: Renderer, width: number) {
  const target = renderer.getRenderTarget()
  const viewport = target?.viewport ?? renderer.getViewport(canvasViewport)
  const shortEdge = Math.min(viewport.z, viewport.w) * (target ? 1 : renderer.getPixelRatio())
  return width * shortEdge / (100 * 1080)
}
