import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, positionGeometry, time} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const p = positionGeometry
    const fuzz = mx_fractal_noise_float(p.mul(16), 4, 2, 0.6).mul(0.5).add(0.5)
    const veins = filament(mx_worley_noise_float(p.mul(4.5)).sub(0.3), 0.02)
    const spores = mx_noise_float(p.mul(26)).smoothstep(0.62, 0.78)
    // Each sporing cluster breathes on its own slow phase.
    const phase = mx_noise_float(p.mul(3)).mul(6.283)
    const breath = time.mul(0.6).add(phase).sin().mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(319, 37, 15)), color(hsl.integer(336, 31, 37)), fuzz).mul(veins.mul(-0.4).add(1))
    this.metalness = 0
    this.roughnessNode = fuzz.mul(0.12).add(0.82)
    this.sheen = 1
    this.sheenRoughness = 0.4
    this.sheenColor.set(hsl.integer(306, 99, 80))
    this.normalNode = proceduralNormal(fuzz, 0.0022)
    this.emissiveNode = color(hsl.integer(161, 74, 88.5)).mul(spores).mul(breath.mul(0.8).add(0.2)).mul(0.9).add(color(hsl.integer(220, 100, 83.5)).mul(veins).mul(0.12))
  }
}
