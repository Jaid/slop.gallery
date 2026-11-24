import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {float, mix, mx_noise_float, vec3} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** A daguerreotype’s pale grains scatter light while its bare silver reflects a dark field head-on and a bright one at a slant. */
export default class SilverplateCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Silver looking glass: a silver plate whose photographic shadows brighten as the viewer turns away from its normal.'
  readonly grain = 1
  readonly polish = 0.5
  readonly reversal = 0.5
  override readonly strength = 0.2
  override readonly title = 'Silver looking glass'

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, luminance, position, view}: CanvasSurface) {
    const deposit = luminance.sqrt().smoothstep(0.12, 0.87).toVar('silverDeposit')
    const field = view.x.abs().smoothstep(0.18, 0.65).mul(this.reversal)
    const grain = mx_noise_float(position.mul(510)).mul(fine(0.003)).mul(this.grain)
    const silver = mix(vec3(0.016, 0.024, 0.033), vec3(1.08, 1.14, 1.2), field)
    const scattered = vec3(0.63, 0.58, 0.49).mul(field.mul(-0.55).add(1)).mul(grain.mul(0.16).add(1))
    material.colorNode = mix(silver, scattered, deposit)
    material.normalNode = heightNormal(grain.mul(deposit).mul(0.00017))
    material.roughnessNode = mix(float(0.61 - this.polish * 0.48), float(0.87), deposit)
    material.metalnessNode = deposit.oneMinus().mul(this.polish * 0.33)
  }
}
