import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, positionGeometry, positionView} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const p = positionGeometry
    const intimate = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const rock = mx_noise_float(p.mul(6)).mul(0.5).add(0.5)
    const crackle = mx_worley_noise_float(p.mul(3.5))
    const cracks = opticalLine(crackle.sub(0.35), 0.025)
    const magma = color(hsl.integer(40.1, 100, 63)).mul(cracks).mul(intimate.mul(0.7).add(0.3))
    this.colorNode = mix(color(hsl.integer(48, 12, 8)), color(hsl.integer(39, 10, 16)), rock)
    this.metalness = 0.05
    this.roughness = 0.85
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(9)), 0.004)
    this.emissiveNode = magma.mul(1.6).add(color(hsl.integer(72, 100, 79.1)).mul(cracks.pow(2)).mul(0.8))
    this.clearcoat = 0.1
    this.clearcoatRoughness = 0.7
  }
}
