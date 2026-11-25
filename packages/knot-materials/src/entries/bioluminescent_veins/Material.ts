import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, positionGeometry, sin, time} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const p = positionGeometry
    const flow = mx_fractal_noise_float(p.mul(3.2), 3, 2, 0.5)
    const veins = filament(flow, 0.03)
    const fineVeins = filament(mx_noise_float(p.mul(9)), 0.02)
    const pulse = sin(time.mul(0.9).add(flow.mul(4))).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(249, 33, 5)), color(hsl.integer(206, 42, 10)), mx_noise_float(p.mul(4)).mul(0.5).add(0.5))
    this.roughness = 0.5
    this.metalness = 0
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.25
    this.normalNode = proceduralNormal(flow, 0.0011)
    this.emissiveNode = color(hsl.integer(170, 100, 87)).mul(veins).mul(pulse.mul(0.7).add(0.3)).mul(1.6).add(color(hsl.integer(252, 100, 59)).mul(fineVeins).mul(0.5))
  }
}
