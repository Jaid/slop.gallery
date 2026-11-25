import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, positionGeometry} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const glaze = mx_noise_float(p.mul(3.5)).mul(0.5).add(0.5)
    const cracksField = mx_worley_noise_float(p.mul(7)).sub(0.3)
    const cracks = filament(cracksField, 0.02)
    this.colorNode = mix(color(hsl.integer(78, 24, 89.5)), color(hsl.integer(57, 83, 52)), glaze.smoothstep(0.35, 0.75))
    this.roughness = 0.55
    this.metalness = 0.05
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.15
    this.normalNode = proceduralNormal(cracksField, 0.0012)
    this.emissiveNode = color(hsl.integer(40, 90, 31)).mul(cracks).mul(0.3)
  }
}
