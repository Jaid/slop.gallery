import type {Camera, Node, RenderPipeline, RenderTarget} from 'three/webgpu'

import {cameraFar, cameraNear, cameraViewMatrix, perspectiveDepthToViewZ, screenUV, texture, uniform, vec4} from 'three/tsl'
import {DepthTexture, Vector2} from 'three/webgpu'

// Sample the finished world pass, never the depth of the postprocessing quad or a depth texture still attached for writing.
const empty = new DepthTexture(1, 1)
const depth = texture(empty)
const uvOffset = uniform(new Vector2)
const available = uniform(false)
export type OverlayDepthPipeline = RenderPipeline & {
  depthProjectionOffset?: Vector2
  scenePass?: {renderTarget: RenderTarget}
  wireframeTarget?: RenderTarget
}
export function useFrameDepth(pipeline: OverlayDepthPipeline | null | undefined, camera: Camera) {
  const target = pipeline?.scenePass?.renderTarget ?? pipeline?.wireframeTarget
  depth.value = target?.depthTexture ?? empty
  available.value = Boolean(target?.depthTexture)
  const offset = pipeline?.depthProjectionOffset
  if (offset) {
    // The scene depth was rasterized with TRAA’s subpixel offset; the final stroke was not.
    const e = camera.projectionMatrix.elements
    uvOffset.value.set((e[8] - offset.x) / 2, (offset.y - e[9]) / 2)
  } else {
    uvOffset.value.set(0, 0)
  }
}
/** Compare in view-space meters. A small bias keeps a stroke marking the surface itself at full strength. */
export function obstructedOpacity(point: Node<'vec3'>, factor: number) {
  const worldZ = perspectiveDepthToViewZ(depth.sample(screenUV.add(uvOffset)).r, cameraNear, cameraFar)
  const strokeZ = cameraViewMatrix.mul(vec4(point, 1)).z
  return available.and(worldZ.sub(strokeZ).greaterThan(strokeZ.abs().mul(0.0001).max(0.002))).select(factor, 1)
}
