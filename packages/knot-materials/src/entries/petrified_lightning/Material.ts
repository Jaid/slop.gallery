import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, sin, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, intimate} = viewerFrame()
    const surfaceNoise = mx_fractal_noise_float(p.mul(20), 3, 2, 0.5)
    const surfaceRoughness = surfaceNoise.mul(0.4).add(0.3)
    const lightningNoise = mx_fractal_noise_float(p.mul(8).add(vec3(0, 0, time.mul(0.1))), 5, 2.5, 0.5)
    const veins = lightningNoise.smoothstep(0.45, 0.48).pow(3)
    const flash = sin(time.mul(15).add(p.y.mul(10))).pow(20).mul(intimate)
    const veinColor = mix(color(hsl.integer(238, 99, 85)), color(hsl.integer(0, 0, 100)), flash)
    this.colorNode = color(hsl.integer(258, 16, 72))
    this.transmission = 0.85
    this.thicknessNode = veins.mul(1.5).add(0.5)
    this.ior = 1.45
    this.roughnessNode = surfaceRoughness
    this.metalness = 0
    this.attenuationColor.set(hsl.integer(264, 32, 38))
    this.attenuationDistance = 1.2
    this.normalNode = proceduralNormal(surfaceNoise, 0.03)
    this.emissiveNode = veinColor.mul(veins).mul(5).add(color(hsl.integer(0, 0, 100)).mul(flash).mul(8))
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.2
  }
}
