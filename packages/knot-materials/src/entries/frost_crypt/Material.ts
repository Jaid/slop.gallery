import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_noise_float, positionGeometry, positionView, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const p = positionGeometry
    const intimate = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const drift = vec3(time.mul(0.01), time.mul(-0.015), time.mul(0.008))
    const iceNoise = mx_noise_float(p.mul(2).add(drift))
    const fracture = opticalLine(mx_noise_float(p.mul(5).sub(drift.mul(2))).sub(0.1), 0.03)
    const deepFracture = opticalLine(mx_noise_float(p.mul(3).add(drift)).sub(0.2), 0.05).mul(intimate)
    this.color.set(hsl.integer(240, 100, 96))
    this.transmission = 0.95
    this.thickness = 0.6
    this.ior = 1.31
    this.roughness = 0.05
    this.metalness = 0
    this.attenuationColor.set(hsl.integer(243, 100, 84))
    this.attenuationDistance = 0.8
    this.normalNode = liquidNormal(intimate, 0.05)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.03
    this.emissiveNode = color(hsl.integer(231, 100, 93)).mul(fracture).mul(0.8).add(spectralColor(iceNoise.mul(3)).mul(deepFracture).mul(0.4))
  }
}
