import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const heat = mx_noise_float(p.mul(2).add(time.mul(0.02))).mul(0.5).add(0.5)
    const temper = spectralColor(heat.mul(3).add(time.mul(0.05)))
    const base = mix(color(hsl.integer(264, 9, 13)), temper, 0.85)
    this.colorNode = base
    this.metalness = 1
    this.roughness = 0.12
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(30)), 0.0004)
    this.iridescence = 0.4
    this.iridescenceThicknessNode = heat.mul(300).add(150)
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.05
    this.emissiveNode = temper.mul(grazing.pow(4)).mul(0.4)
  }
}
