import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionViewDirection} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const crackle = mx_worley_noise_float(p.mul(4))
    const lines = opticalLine(crackle.sub(0.42), 0.015)
    const sand = mx_noise_float(p.mul(10)).mul(0.5).add(0.5)
    const clay = mix(color(hsl.integer(72, 40, 68)), color(hsl.integer(64, 53, 46)), sand)
    const glaze = mix(color(hsl.integer(235, 57, 38)), color(hsl.integer(233, 51, 23)), sand)
    const pool = mx_noise_float(p.mul(2)).smoothstep(0.4, 0.6)
    this.colorNode = mix(clay, glaze, pool).add(color(hsl.integer(0, 0, 100)).mul(lines).mul(0.1))
    this.metalness = 0.05
    this.roughnessNode = mix(0.6, 0.25, pool).add(lines.mul(0.4))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(16)), 0.0015)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.06
    this.emissiveNode = color(hsl.integer(228, 100, 78)).mul(lines).mul(grazing).mul(0.3)
  }
}
