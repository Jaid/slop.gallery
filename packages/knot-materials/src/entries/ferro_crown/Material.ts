import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_noise_float, mx_worley_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionViewDirection, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.3)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // Cell centres pull into spikes, as ferrofluid does over a magnet array.
    const cells = mx_worley_noise_float(p.mul(6.2)).oneMinus().clamp()
    const breathe = time.mul(0.22).sin().mul(0.18).add(0.82)
    const spikes = cells.pow(3).mul(breathe)
    const ripple = mx_noise_float(p.mul(14)).mul(0.5).add(0.5)
    this.positionNode = p.add(normalLocal.mul(spikes.mul(0.042)))
    this.colorNode = color(hsl.integer(268, 18, 6))
    this.metalness = 1
    this.roughnessNode = spikes.oneMinus().mul(0.09).add(ripple.mul(0.025)).add(0.03)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.iridescence = 0.55
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = spikes.mul(420).add(ripple.mul(60)).add(160)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(20)), 0.0008)
    this.emissiveNode = color(hsl.integer(266, 100, 52)).mul(grazing.pow(3)).mul(0.3).add(color(hsl.integer(265, 100, 76.4)).mul(spikes.pow(2)).mul(0.22))
  }
}
