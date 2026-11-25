import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const patina = mx_fractal_noise_float(p.mul(2.5), 4, 2, 0.5).mul(0.5).add(0.5)
    const crust = patina.smoothstep(0.45, 0.75)
    const bronze = color(hsl.integer(63, 64, 43))
    const verdigris = color(hsl.integer(184, 73, 61))
    const base = mix(bronze, verdigris, crust)
    const rough = mix(0.15, 0.85, crust).add(mx_noise_float(p.mul(12)).mul(0.05))
    this.colorNode = base
    this.metalness = 1
    this.roughnessNode = rough
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(14)), 0.0025)
    this.iridescence = 0.15
    this.iridescenceIOR = 1.3
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.3
    this.emissiveNode = color(hsl.integer(176, 70, 29)).mul(crust).mul(rim).mul(0.2)
  }
}
