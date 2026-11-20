import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {color, mix, mx_noise_float, vec2} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** Cold-pressed cotton rag paper: the ink settles into the tooth’s tiny hollows while flecks of cotton on its crests keep their light. */
export default class RagCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Cold-press rag: cotton paper whose tooth holds the ink in its hollows while flecks of cotton on its crests stay pale.'
  /** how much the cotton on the crests shows, against what it was made with */
  readonly flecks = 1
  override readonly scale = 0.5
  override readonly strength = 0.5
  override readonly title = 'Cold-press rag'
  /** how deep the paper’s tooth is, against what it was made with */
  readonly tooth = 1.5
  protected override readonly weight = 0.63

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, image, position}: CanvasSurface) {
    const felt = mx_noise_float(position.mul(143)).mul(0.7).add(mx_noise_float(position.mul(vec2(85, 261))).mul(0.3)).toVar('ragFelt')
    const tooth = felt.mul(fine(0.008))
    const crests = tooth.smoothstep(0.06, 0.67)
    material.colorNode = mix(image.mul(tooth.mul(0.12).sub(0.02).mul(this.tooth).add(1)), color('#ddd3be'), crests.mul(this.flecks * 0.063).min(1))
    material.normalNode = heightNormal(tooth.mul(0.00085).add(mx_noise_float(position.mul(32)).mul(0.0005)).mul(this.tooth))
    material.roughness = 0.98
  }
}
