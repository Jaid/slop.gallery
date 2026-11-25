import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const nacre = mx_fractal_noise_float(p.mul(3), 3, 2, 0.5).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(92, 31, 95)), color(hsl.integer(214, 18, 89)), nacre)
    this.transmission = 0.68
    this.thickness = 0.42
    this.ior = 1.52
    this.attenuationColor.set(hsl.integer(92, 47, 95))
    this.attenuationDistance = 0.55
    this.roughness = 0.1
    this.metalness = 0
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.06
    this.iridescence = 1
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = nacre.mul(460).add(160)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(9)), 0.001)
    this.emissiveNode = spectralColor(nacre.mul(6).add(time.mul(0.04))).mul(0.18).mul(near.mul(0.6).add(0.4)).add(color(hsl.integer(0, 0, 100)).mul(rim).mul(0.1))
  }
}
