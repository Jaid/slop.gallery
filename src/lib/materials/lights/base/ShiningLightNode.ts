import type {AnalyticLightNode, Light, Node, NodeBuilder} from 'three/webgpu'

import {If, renderGroup, uniform, vec3} from 'three/tsl'
import {LightingNode} from 'three/webgpu'

type LightingContext = {
  reflectedLight: {
    directDiffuse: Node<'vec3'>
    directSpecular: Node<'vec3'>
  }
}

/**
 * Lights like the light node it wraps, but only while its light shines.
 *
 * three runs every light’s lighting and shadow code for every lit fragment, even for a light switched down to an intensity of 0, which only multiplies all of it by 0. This node puts the wrapped light’s code behind a branch on a uniform, which every fragment of a pass takes alike, so a dark light skips its shadow lookups and lighting, while its code stays in every shader and lighting it again rebuilds nothing.
 *
 * The light adds onto sums declared before the branch, which add onto the material’s afterward, like {@link PointLightsNode}’s loop: a variable that the branch declares first only lives inside it, and three declares the material’s anew for the code after it, which drops what the light added.
 * It must keep a hash of its own, too: three builds a node whose hash an already built node has as that node instead, so the wrapped node would never build, and neither its uniforms nor its shadow map would ever update.
 */
export default class ShiningLightNode extends LightingNode {
  static readonly type = 'ShiningLightNode'
  private readonly intensity

  constructor(readonly lightNode: AnalyticLightNode<Light>) {
    super()
    const light = lightNode.light!
    this.intensity = uniform(0).setGroup(renderGroup).onRenderUpdate(() => light.intensity)
  }

  override setup(builder: NodeBuilder): undefined {
    const {reflectedLight} = builder.context as LightingContext
    const directDiffuse = vec3(0).toVar()
    const directSpecular = vec3(0).toVar()
    // The branch builds its light later, inside whatever context is current by then.
    If(this.intensity.greaterThan(0), () => {
      const context = builder.context as LightingContext
      builder.context = {
        ...context,
        reflectedLight: {
          ...context.reflectedLight,
          directDiffuse,
          directSpecular,
        },
      }
      try {
        this.lightNode.build(builder)
      } finally {
        builder.context = context
      }
    })
    reflectedLight.directDiffuse.addAssign(directDiffuse)
    reflectedLight.directSpecular.addAssign(directSpecular)
  }
}
