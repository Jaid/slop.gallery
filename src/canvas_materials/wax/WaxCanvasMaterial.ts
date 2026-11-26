import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, vec2} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** A thin coat of beeswax rubbed over the paint: a milky bloom over the dark parts, polished smoother where the cloth went over it most. */
export default class WaxCanvasMaterial extends CanvasMaterial {
  /** how milky the wax blooms over dark paint, against what it was made with */
  readonly bloom = 1
  override readonly description = 'Beeswax veil: a thin coat of wax with a milky bloom over the dark paint, polished smoother where the cloth went over it most.'
  /** how far the cloth polished the wax, 0 for none and 1 for a high polish */
  readonly polish = 0.5
  override readonly strength = 0.5
  override readonly title = 'Beeswax veil'
  protected override readonly weight = 0.49

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'light',
        description: 'rubbing relief under a clearcoat, both roughnesses following the rubbing',
      },
      {
        base: 'texture',
        description: 'luminance: the milky bloom gathers over dark paint',
      },
    ]
  }

  protected override paint(material: MeshPhysicalNodeMaterial, {image, luminance, position}: CanvasSurface) {
    // Patches of the cloth’s rubbing, streaked along its strokes.
    const rubbed = mx_noise_float(position.mul(vec2(7, 16)).add(mx_noise_float(position.mul(4)))).mul(0.52).add(mx_noise_float(position.mul(52)).mul(0.18)).add(0.5).clamp().toVar('waxRubbed')
    const bloom = rubbed.smoothstep(0.24, 0.78).mul(luminance.sqrt().oneMinus())
    material.colorNode = mix(image, color(hsl.integer(83, 43, 83)), bloom.mul(this.bloom * 0.041).min(1))
    material.normalNode = heightNormal(rubbed.mul(0.00095))
    material.roughnessNode = mix(float(0.62 - this.polish * 0.4), float(0.8), rubbed)
    material.clearcoat = this.polish * 0.64
    material.clearcoatRoughnessNode = rubbed.mul(0.27).add(0.25)
  }
}
