import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const cracks = filament(mx_noise_float(p.mul(6).add(mx_noise_vec3(p.mul(3)).mul(0.5))), 0.02)
    const deepCracks = filament(mx_noise_float(deep.mul(15)), 0.024)
    const pulse = mx_noise_float(inner.mul(2).add(vec3(0, time.mul(0.25), 0))).mul(0.5).add(0.5)
    const heat = mix(color(hsl.integer(37, 93, 13)), color(hsl.integer(37.7, 100, 63)), cracks)
    this.colorNode = mix(color(hsl.integer(55, 24, 4.4)), heat, cracks.mul(0.9).add(0.05))
    this.metalnessNode = cracks.oneMinus().mul(0.15)
    this.roughnessNode = cracks.mul(-0.25).add(0.42)
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.12
    this.iridescence = 0.25
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = cracks.oneMinus().mul(150).add(180)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(9)), 0.006)
    this.emissiveNode = mix(color(hsl.integer(32, 100, 58.5)), color(hsl.integer(91, 100, 85.9)), cracks.pow(2)).mul(cracks).mul(pulse.mul(0.5).add(0.6)).mul(near.mul(0.5).add(0.6)).add(color(hsl.integer(49.3, 100, 68)).mul(deepCracks).mul(near).mul(0.4)).add(color(hsl.integer(51, 100, 71)).mul(rim).mul(0.15))
  }
}
