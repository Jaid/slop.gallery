import type {DepthTexture, Node, NodeFrame, Object3D, Texture, TextureNode} from 'three/webgpu'

import {linearDepth, screenUV} from 'three/tsl'
import {NodeUpdateType, ViewportDepthTextureNode, ViewportTextureNode} from 'three/webgpu'

type CopyStamp = {
  calls: number
  object: Object3D | null
  renderId: number
}

/**
 * Tracks the last `(calls, renderId, object)` for which each per-target framebuffer or depth texture was copied.
 * Because `.sample()` clones share the base node’s per-target texture, multiple samples on the same material
 * reuse a single copy per drawn object, while each subsequent object in the transparent pass gets a fresh copy
 * that includes everything drawn before it (including orbs, transmissive knots and other glass panes).
 */
const copiedFor = new WeakMap<Texture, CopyStamp>
function shouldCopy(texture: Texture, frame: NodeFrame) {
  const calls = frame.renderer?.info.calls ?? -1
  const previous = copiedFor.get(texture)
  if (previous?.calls === calls && previous.renderId === frame.renderId && previous.object === frame.object) {
    return false
  }
  copiedFor.set(texture, {
    calls,
    object: frame.object,
    renderId: frame.renderId,
  })
  return true
}
class LiveViewportTextureNode extends ViewportTextureNode {
  constructor(uvNode: Node = screenUV, levelNode: Node | null = null, framebufferTexture: Texture | null = null) {
    super(uvNode, levelNode, framebufferTexture)
    this.updateBeforeType = NodeUpdateType.OBJECT
  }

  override updateBefore(frame: NodeFrame) {
    if (!shouldCopy(this.value, frame)) {
      return
    }
    return super.updateBefore(frame)
  }
}
class LiveViewportDepthTextureNode extends ViewportDepthTextureNode {
  constructor(uvNode: Node = screenUV, levelNode: Node | null = null, depthTexture: DepthTexture | null = null) {
    super(uvNode, levelNode, depthTexture)
    this.updateBeforeType = NodeUpdateType.OBJECT
  }

  override updateBefore(frame: NodeFrame) {
    if (!shouldCopy(this.value, frame)) {
      return
    }
    return super.updateBefore(frame)
  }
}
const sharpColor = new LiveViewportTextureNode
const mipColor = new LiveViewportTextureNode
mipColor.generateMipmaps = true
const liveDepth = new LiveViewportDepthTextureNode

/** Full-resolution copy of the framebuffer right before the current object draws, without mipmaps. */
export function liveViewportTexture(uv: Node<'vec2'> = screenUV): TextureNode {
  return sharpColor.sample(uv)
}

/** Mipmapped copy of the framebuffer right before the current object draws, including earlier transparent and transmissive objects. */
export function liveViewportMipTexture(uv: Node<'vec2'> = screenUV): TextureNode {
  return mipColor.sample(uv)
}

/** Copy of the depth buffer right before the current object draws, including earlier depth-writing transparent and transmissive objects. */
export function liveViewportDepthTexture(uv: Node<'vec2'> = screenUV): TextureNode {
  return liveDepth.sample(uv)
}

/** Keeps refracted lookups from pulling in foreground surfaces that lie closer to the camera than the glass itself. */
export function liveViewportSafeUV(uv: Node<'vec2'>): Node<'vec2'> {
  const depth = linearDepth()
  const depthDiff = linearDepth(liveViewportDepthTexture(uv)).sub(depth)
  return depthDiff.lessThan(0).select<'vec2'>(screenUV, uv)
}
