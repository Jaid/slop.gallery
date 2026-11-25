import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const rim = facing.oneMinus().pow(2)
    const field = mx_noise_float(p.mul(6))
    const shards = filament(field, 0.02)
    const fineField = mx_noise_float(p.mul(18))
    const fineShards = filament(fineField, 0.01)
    this.colorNode = mix(color(hsl.integer(284, 19, 6)), color(hsl.integer(285, 22, 14)), field.mul(0.5).add(0.5))
    this.metalness = 0.1
    this.roughness = 0.06
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.normalNode = proceduralNormal(field, 0.001)
    this.emissiveNode = color(hsl.integer(43, 100, 68)).mul(shards).mul(0.4).add(color(hsl.integer(273, 100, 52)).mul(fineShards).mul(0.15)).add(color(hsl.integer(0, 0, 100)).mul(rim).mul(0.08))
  }
}
