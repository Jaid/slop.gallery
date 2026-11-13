import type {Material, Node, Texture} from 'three/webgpu'

import {linearDepth, screenUV} from 'three/tsl'
import {DepthTexture, FramebufferTexture, LinearFilter, NodeUpdateType, ViewportTextureNode} from 'three/webgpu'

/** A fresh copy before each draw, not just before the first transparent object of a render. */
class GlassViewportTexture extends ViewportTextureNode {
  private readonly releases = new Map<Texture, () => void>

  constructor(uv: Node, level: Node | null, framebuffer: Texture) {
    super(uv, level, framebuffer)
    this.updateBeforeType = NodeUpdateType.OBJECT
    this.track(framebuffer)
  }

  override clone() {
    const sample = super.clone()
    // TextureNode.sample builds its referenceNode too. Only that root copies; the UV samples share it without copying again.
    sample.updateBeforeType = NodeUpdateType.NONE
    // super.clone passes the root’s texture to the constructor; a sample borrows it rather than owning it.
    sample.releases.clear()
    return sample
  }

  override dispose() {
    for (const release of this.releases.values()) {
      release()
    }
    super.dispose()
  }

  override getTextureForReference(reference?: Parameters<ViewportTextureNode['getTextureForReference']>[0]) {
    const texture = super.getTextureForReference(reference)
    if (!this.referenceNode) {
      this.track(texture, reference)
    }
    return texture
  }

  private track(texture: Texture, reference?: Parameters<ViewportTextureNode['getTextureForReference']>[0]) {
    if (this.releases.has(texture)) {
      return
    }
    const lifetime: {
      addEventListener: (type: 'dispose', listener: () => void) => void
      removeEventListener: (type: 'dispose', listener: () => void) => void
    } | null | undefined = reference
    const release = () => {
      lifetime?.removeEventListener('dispose', release)
      this.releases.delete(texture)
      texture.dispose()
    }
    this.releases.set(texture, release)
    // Targets are replaced when the postprocessing graph changes. Do not keep their full-size copies until the last glass leaves.
    // A disposed target may render again (setSize also disposes); getTextureForReference then tracks its recreated copy again.
    lifetime?.addEventListener('dispose', release)
  }
}

/**
 * The scene behind architectural glass, including already-drawn orbs, transmissive Knots and other panes.
 *
 * Color and depth are copied together before each glass draw. The opaque-only singleton belongs to physical transmission and the orbs, so neither it nor its depth texture may be overwritten here. All glass shares one scratch pair per render target (including reflections), with no mip chain: every pane consumes its copy before the next one replaces it.
 */
export default class GlassBackdrop {
  private static shared?: GlassBackdrop
  /** Retain the shared scratch textures until the last material using them is disposed. */
  static forMaterial(material: Material) {
    this.shared ??= new GlassBackdrop
    const backdrop = this.shared
    if (backdrop.materials.has(material)) {
      return backdrop
    }
    backdrop.materials.add(material)
    backdrop.owners++
    const release = () => {
      material.removeEventListener('dispose', release)
      backdrop.materials.delete(material)
      if (--backdrop.owners === 0) {
        backdrop.color.dispose()
        backdrop.depth.dispose()
        GlassBackdrop.shared = undefined
      }
    }
    material.addEventListener('dispose', release)
    return backdrop
  }
  readonly color: GlassViewportTexture
  readonly depth = new GlassViewportTexture(screenUV, null, new DepthTexture)

  private readonly materials = new WeakSet<Material>
  private owners = 0

  private constructor() {
    const framebuffer = new FramebufferTexture(1, 1)
    framebuffer.minFilter = LinearFilter
    framebuffer.magFilter = LinearFilter
    this.color = new GlassViewportTexture(screenUV, null, framebuffer)
  }

  /** Like viewportSafeUV, but checked against this draw’s depth, including depth-writing transparent props. */
  safeUV(uv: Node<'vec2'>): Node<'vec2'> {
    return linearDepth(this.depth.sample(uv)).lessThan(linearDepth()).select(screenUV, uv)
  }
}
