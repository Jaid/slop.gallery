import type {Node, NodeBuilder, NodeMaterial, TextureNode} from 'three/webgpu'

import BloomNode from 'three/addons/tsl/display/BloomNode.js'
import {float, Fn, mix, uniformArray, vec4} from 'three/tsl'

/** The Three.js bloom pass has five fixed mip samplers and private blur builders. Keep its render passes, but specialize their count, kernels and composite instead of copying the entire addon. */
type BloomInternals = {
  _compositeMaterial: NodeMaterial
  _getSeparableBlurMaterial: (context: unknown, radius: number) => NodeMaterial
  _nMips: number
  _textureNodeBlur0: TextureNode
  _textureNodeBlur1: TextureNode
  _textureNodeBlur2: TextureNode
  _textureNodeBlur3: TextureNode
  _textureNodeBlur4: TextureNode
}

/** A BloomNode with configurable blur-pass count and the base Gaussian kernel radius. The subsequent levels use radii +4, matching the stock [6, 10, 14, 18, 22] at radius 6. */
export default class ConfigurableBloomNode extends BloomNode {
  private readonly gaussianKernelSize: number
  private readonly mipCount: number

  constructor(input: Node<'vec4'>, mipCount: number, gaussianKernelSize: number) {
    super(input)
    this.mipCount = mipCount
    this.gaussianKernelSize = gaussianKernelSize
    // The stock constructor allocates all five render targets, but both its sizing and rendering loops use _nMips.
    ;(this as unknown as BloomInternals)._nMips = mipCount
  }

  /** Three builds its blur materials through this method; the radius per level is otherwise hardcoded. */
  _getSeparableBlurMaterial(context: unknown, stockRadius: number): NodeMaterial {
    const base = (BloomNode.prototype as unknown as BloomInternals)._getSeparableBlurMaterial
    return base.call(this, context, stockRadius + this.gaussianKernelSize - 6)
  }

  override setup(builder: NodeBuilder) {
    const output = super.setup(builder)
    const bloom = this as unknown as BloomInternals
    const textures = [bloom._textureNodeBlur0, bloom._textureNodeBlur1, bloom._textureNodeBlur2, bloom._textureNodeBlur3, bloom._textureNodeBlur4]
    const tint = uniformArray(this.bloomTintColors)
    // The stock composite always samples all five levels, even when its render loop is shortened. Replace only that shader.
    bloom._compositeMaterial.fragmentNode = Fn(() => {
      const contribution = (index: number) => {
        const factor = 1 - index * 0.2
        return textures[index].mul(mix(float(factor), float(1.2 - factor), this.radius)).mul(vec4(tint.element(index) as unknown as Node<'vec3'>, 1))
      }
      let sum = contribution(0)
      for (let index = 1; index < this.mipCount; index++) {
        sum = sum.add(contribution(index))
      }
      return sum.mul(this.strength)
    })()
    bloom._compositeMaterial.needsUpdate = true
    return output
  }
}
