import type {LightingModelDirectInput, Node, NodeBuilder} from 'three/webgpu'

import {cameraViewMatrix, normalView, positionViewDirection, refract, vec4} from 'three/tsl'
import {PhysicalLightingModel} from 'three/webgpu'

type Vec3 = Node<'vec3'>

/**
 * Physical lighting for a polished stone whose crystals flash with color when light reflects off the fine layers inside them, the schiller of labradorite and larvikite.
 *
 * Each crystal’s layers lie parallel to one plane, `lamella` (its normal in view space). Light refracts into the stone (`ior`), reflects off them like off a mirror and refracts back out, so a crystal lights up in its `schiller` color only while the half vector between the light and the eye, both bent into the stone, lines up with the normal of its layers, within a lobe as narrow as `sharpness` makes it. So one crystal after another flashes and goes dark again as the eye or the light moves.
 *
 * The light of the room round it, which comes from everywhere, makes the flashes too, only fainter and broader: they are worked out as though it all came from overhead, the way the light of a room mostly falls.
 */
export default class SchillerLightingModel extends PhysicalLightingModel {
  constructor(readonly lamella: Vec3, readonly schiller: Vec3, readonly sharpness: number, readonly ior: number) {
    super()
  }
  override direct(input: LightingModelDirectInput, builder: NodeBuilder) {
    super.direct(input, builder)
    const lightColor = input.lightColor as Vec3
    const lightDirection = input.lightDirection as Vec3
    const irradiance = normalView.dot(lightDirection).clamp().mul(lightColor)
    const directSpecular = input.reflectedLight.directSpecular as Vec3
    directSpecular.addAssign(irradiance.mul(this.flash(lightDirection, this.sharpness)).mul(this.schiller))
  }
  override indirectSpecular(builder: NodeBuilder) {
    super.indirectSpecular(builder)
    const {irradiance, reflectedLight} = builder.context as {
      irradiance: Vec3
      reflectedLight: {indirectSpecular: Vec3}
    }
    const overhead = cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz
    reflectedLight.indirectSpecular.addAssign(irradiance.mul(this.flash(overhead, this.sharpness / 4)).mul(this.schiller).mul(0.25))
  }
  /** How strongly the layers mirror light from `direction` (view space, toward the light) into the eye. */
  private flash(direction: Vec3, sharpness: number) {
    const inward = (toward: Vec3) => refract(toward.negate(), normalView, 1 / this.ior).negate()
    const half = inward(direction).add(inward(positionViewDirection)).normalize()
    return half.dot(this.lamella).abs().pow(sharpness)
  }
}
