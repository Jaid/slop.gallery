import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec2, positionGeometry} from 'three/tsl'

import BrassMaterial, {brassColor} from './BrassMaterial.ts'
import {heightNormal, visibleDetail} from './filters.ts'

/** Antique chandelier brass: small hammer marks under a rubbed polish and patches of green oxidation. */
export default class HammeredBrassMaterial extends BrassMaterial {
  constructor() {
    super()
    this.name = 'Hammered antique brass'
    const p = positionGeometry
    const footprint = p.x.fwidth().max(p.y.fwidth()).max(p.z.fwidth())
    const hammer = mx_worley_noise_vec2(p.mul(95)).x
    const patina = mx_noise_float(p.mul(7)).mul(0.5).add(0.5).smoothstep(0.5, 0.8).mul(0.65)
    this.colorNode = mix(color(brassColor), color(hsl.integer(163, 35, 36)), patina)
    this.metalnessNode = float(1).sub(patina.mul(0.8))
    this.roughnessNode = float(0.23).add(patina.mul(0.4)).add(hammer.mul(0.1))
    this.normalNode = heightNormal(hammer.mul(0.00035).mul(visibleDetail(footprint, 0.01)))
  }
}
