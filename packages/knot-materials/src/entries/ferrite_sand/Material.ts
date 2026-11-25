import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const drift = vec3(time.mul(0.03), time.mul(0.02), time.mul(-0.025))
    const mineral = mx_noise_float(p.mul(6)).mul(0.5).add(0.5)
    const fieldLines = opticalLine(mx_worley_noise_float(inner.mul(3.2).add(drift)).sub(0.3), 0.018)
    this.colorNode = mix(color(hsl.integer(249, 19, 11)), color(hsl.integer(246, 19, 38)), mineral)
    this.metalness = 0.22
    this.roughness = 0.34
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.2
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(14)), 0.0014)
    this.emissiveNode = color(hsl.integer(217, 99, 78.9)).mul(fieldLines).mul(near.mul(0.9).add(0.15)).add(color(hsl.integer(50, 99, 71)).mul(rim).mul(0.1))
  }
}
