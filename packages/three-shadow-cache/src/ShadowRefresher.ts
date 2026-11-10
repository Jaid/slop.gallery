import type {Camera, Light, LightShadow} from 'three/webgpu'

/**
 * Lets shadow maps that left something out, like objects still loading, render again despite the cache, one map per frame, each in turn, since rendering them all every frame can cost more than what they wait for.
 * Visit every shadow-casting light of a frame, then call {@link endFrame}.
 */
export default class ShadowRefresher {
  private readonly refreshed = new Set<Camera>
  private refreshing = false

  /** Ends the frame: once every incomplete map had its turn, the next round starts. */
  endFrame() {
    if (!this.refreshing) {
      this.refreshed.clear()
    }
    this.refreshing = false
  }

  /** Lets the light’s map render this frame if `incomplete` says its shadow camera missed something and no other map took this frame’s turn. */
  visit(light: Light & {shadow: LightShadow}, incomplete: (camera: Camera) => boolean) {
    const {camera} = light.shadow
    if (this.refreshing || this.refreshed.has(camera) || !incomplete(camera)) {
      return
    }
    light.shadow.needsUpdate = true
    this.refreshed.add(camera)
    this.refreshing = true
  }
}
