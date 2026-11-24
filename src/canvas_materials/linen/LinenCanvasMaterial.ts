import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {color, mix, mx_noise_float, vec2} from 'three/tsl'

import {heightNormal} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

const tau = 2 * Math.PI

/** Linen canvas: the paint sinks between warp and weft, which cross over and under each other, and the unbleached threads show through where it lies thin. */
export default class LinenCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Loom linen: paint sunk into a plain weave of warp and weft, with bare, unbleached threads showing through in its shadows.'
  /** how much of the bare threads shows, against what it was made with */
  readonly fibers = 0.7
  /** how deep the weave is, against what it was made with */
  readonly relief = 2
  override readonly scale = 0.5
  /** how strongly the threads catch grazing light */
  readonly sheen = 0.1
  override readonly strength = 0.1
  override readonly title = 'Loom linen'

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, image, position}: CanvasSurface) {
    // 125 warp and 154 weft threads per meter, each wavering a little.
    const thread = position.mul(vec2(125, 154)).add(vec2(mx_noise_float(position.mul(19)), mx_noise_float(position.mul(17).add(9))).mul(0.19)).toVar('linenThread')
    const warp = thread.x.mul(tau).cos().mul(0.5).add(0.5)
    const weft = thread.y.mul(tau).cos().mul(0.5).add(0.5)
    const crossover = thread.x.mul(Math.PI).cos().mul(thread.y.mul(Math.PI).cos()).mul(0.49).add(0.5)
    const weave = mix(warp, weft, crossover).toVar('linenWeave')
    const detail = fine(0.0075)
    const grain = mx_noise_float(position.mul(vec2(11, 68))).mul(0.5).add(0.5)
    const bare = weave.smoothstep(0.65, 0.95).mul(detail).mul(grain.mul(0.75).add(0.25))
    material.colorNode = mix(image.mul(weave.sub(0.5).mul(detail).mul(0.33).sub(0.09).mul(this.relief).add(1)), color('#c1a686'), bare.mul(this.fibers * 0.19).min(1))
    material.normalNode = heightNormal(weave.mul(detail).mul(0.00155).add(grain.mul(0.0007)).mul(this.relief))
    material.roughness = 0.93
    material.sheen = this.sheen
    material.sheenColor.set('#dcc9ac')
  }
}
