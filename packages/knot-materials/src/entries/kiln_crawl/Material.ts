import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const glaze = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const cracks = opticalLine(mx_worley_noise_float(p.mul(4.2)).sub(0.35), 0.012)
    this.colorNode = mix(color(hsl.integer(197, 72, 22)), color(hsl.integer(77, 31, 88)), glaze)
    this.roughness = 0.18
    this.metalness = 0.05
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.08
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(16)), 0.001)
    this.emissiveNode = color(hsl.integer(37.7, 100, 63)).mul(cracks).mul(near.mul(0.8).add(0.3)).mul(1.4).add(color(hsl.integer(72, 100, 79.1)).mul(cracks.pow(2)).mul(0.5)).add(color(hsl.integer(77, 100, 93.4)).mul(rim).mul(0.06))
  }
}
