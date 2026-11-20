import type {Camera, Renderer, Scene} from 'three/webgpu'

import {ColorManagement, NoToneMapping} from 'three/webgpu'

const overlays = new WeakMap<Camera, {
  renderer: Renderer
  scene: Scene
}>

/** The outlines live in their own scene so they never enter reflections, shadows or the color grading and temporal resolve of the world. */
export function registerGeofenceOverlay(camera: Camera, renderer: Renderer, scene: Scene) {
  overlays.set(camera, {
    renderer,
    scene,
  })
  return () => {
    overlays.delete(camera)
  }
}

/** Draw the red/blue lines directly onto the finished frame (canvas or capture), using the same output target as the pipeline’s final quad. */
export function drawGeofenceOverlay(camera: Camera) {
  const overlay = overlays.get(camera)
  if (!overlay) {
    return
  }
  const {renderer, scene} = overlay
  const {autoClear, outputColorSpace, toneMapping} = renderer
  try {
    renderer.autoClear = false
    // Like RenderPipeline.render(): skip Three’s intermediate framebuffer and second output transform.
    renderer.outputColorSpace = ColorManagement.workingColorSpace
    renderer.toneMapping = NoToneMapping
    renderer.render(scene, camera)
  } finally {
    renderer.autoClear = autoClear
    renderer.outputColorSpace = outputColorSpace
    renderer.toneMapping = toneMapping
  }
}
