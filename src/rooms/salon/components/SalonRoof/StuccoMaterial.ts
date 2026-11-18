import {attribute, color, max, mix, mx_noise_float, positionGeometry, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

/** Troweled lime stucco, laid warmer in the flutes where the thin finish coat pools. */
export default class StuccoMaterial extends MeshStandardNodeMaterial {
  constructor(heavy: boolean, clay = false) {
    super({
      name: clay ? 'salon-clay-stucco' : 'salon-ivory-stucco',
      roughness: 0.76,
    })
    const point = positionGeometry
    const clouds = mx_noise_float(point.mul(vec3(1.2, 2.2, 1.5)))
    const strokes = mx_noise_float(point.mul(vec3(3.3, 4.2, 0.76)).add(7))
    const tone = clouds.mul(0.096).add(strokes.mul(0.052)).add(1)
    this.colorNode = clay ? color('#a87759').mul(tone) : mix(color('#eee1cb'), color('#c7a789'), attribute<'float'>('flute').mul(0.8)).mul(tone)
    if (heavy) {
      const footprint = max(point.dFdx().length(), point.dFdy().length())
      const lime = mx_noise_float(point.mul(75)).mul(visibleDetail(footprint, 1 / 75))
      this.normalNode = heightNormal(strokes.mul(0.0015).add(lime.mul(0.00028)))
      this.roughnessNode = strokes.mul(0.08).add(lime.mul(0.065)).add(0.76)
    }
  }
}
