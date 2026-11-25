import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionViewDirection} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // Two crackle generations: a coarse craze plus a finer secondary net.
    const coarse = opticalLine(mx_worley_noise_float(p.mul(3.1)).sub(0.2), 0.012)
    const fine = opticalLine(mx_worley_noise_float(p.mul(7.4)).sub(0.16), 0.01).mul(0.55)
    const craze = coarse.max(fine)
    // Glaze pools thicker in the hollows, reading darker and greener.
    const pooling = mx_fractal_noise_float(p.mul(2.2), 3, 2, 0.5).mul(0.5).add(0.5)
    const speck = mx_noise_float(p.mul(26)).mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(153, 28, 92)), color(hsl.integer(166, 39, 68)), pooling.pow(1.4))
    this.colorNode = mix(body, color(hsl.integer(178, 35, 37)), craze.mul(0.8)).mul(speck.mul(0.06).add(0.97))
    this.metalness = 0
    this.roughnessNode = craze.mul(0.35).add(pooling.mul(0.06)).add(0.09)
    this.transmission = 0.18
    this.thickness = 0.22
    this.ior = 1.55
    this.attenuationColor.set(hsl.integer(167, 46, 65))
    this.attenuationDistance = 0.3
    this.clearcoat = 1
    this.clearcoatRoughnessNode = craze.mul(0.25).add(0.04)
    this.sheen = 0.3
    this.sheenRoughness = 0.5
    this.sheenColor.set(hsl.integer(157, 40, 95.6))
    this.normalNode = proceduralNormal(craze.mul(0.6).add(pooling.mul(0.3)), 0.0022)
    this.emissiveNode = color(hsl.integer(165, 34, 89.4)).mul(grazing.pow(4)).mul(0.1)
  }
}
