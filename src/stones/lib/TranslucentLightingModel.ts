import type {LightingModelDirectInput, Node, NodeBuilder} from 'three/webgpu'

import {diffuseContribution, normalView} from 'three/tsl'
import {PhysicalLightingModel} from 'three/webgpu'

/**
 * Physical lighting for stone that light enters a few millimeters before it scatters back out, like marble: every light reaches on past where Lambert would leave the surface dark, as though wrapped round it by `wrap` (0 is plain Lambert), and what it lights there comes back tinted by `scatter`, the warmth of what the stone took from it on the way.
 *
 * So turning forms shade softly into their terminators, and chipped edges and thin lips glow faintly instead of breaking off into shade. Where a shadow falls, the light is gone, so a sculpture never glows through.
 */
export default class TranslucentLightingModel extends PhysicalLightingModel {
  constructor(readonly wrap: number, readonly scatter: Node<'color'>) {
    super()
  }
  override direct(input: LightingModelDirectInput, builder: NodeBuilder) {
    super.direct(input, builder)
    const lightColor = input.lightColor as Node<'vec3'>
    const lightDirection = input.lightDirection as Node<'vec3'>
    const lambert = normalView.dot(lightDirection)
    // Only the light the wrap adds over Lambert’s, which is most at the terminator and none where the light falls square on.
    const wrapped = lambert.add(this.wrap).div(1 + this.wrap).clamp().sub(lambert.clamp())
    const directDiffuse = input.reflectedLight.directDiffuse as Node<'vec3'>
    directDiffuse.addAssign(wrapped.mul(lightColor).mul(diffuseContribution).mul(this.scatter).div(Math.PI))
  }
}
