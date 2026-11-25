import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_fractal_noise_float, mx_noise_float, sin, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, rim} = viewerFrame()
    const drift = vec3(time.mul(0.02), time.mul(-0.015), time.mul(0.01))
    const inclusionNoise = mx_fractal_noise_float(p.mul(3).add(drift), 4, 2, 0.5)
    const inclusion = inclusionNoise.smoothstep(0.1, 0.5)
    const coreGlow = inclusion.mul(sin(time.mul(0.5)).mul(0.2).add(0.8))
    this.colorNode = color(hsl.integer(59, 100, 71))
    this.transmission = 0.95
    this.thicknessNode = inclusion.mul(2).add(0.5)
    this.ior = 1.55
    this.attenuationColor.set(hsl.integer(55, 100, 39))
    this.attenuationDistance = 0.8
    this.roughness = 0.05
    this.metalness = 0
    this.dispersion = 0.4
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(40)), 0.005)
    this.emissiveNode = color(hsl.integer(74, 100, 77)).mul(coreGlow).mul(2).add(rim.mul(color(hsl.integer(35.2, 100, 60.4))).mul(0.4))
  }
}
