import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
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
    const spikes = mx_noise_float(p.mul(20).add(view.mul(5))).mul(0.5).add(0.5).pow(3)
    const flow = liquidNormal(near, 0.8)
    this.colorNode = color(hsl.integer(0, 0, 8))
    this.metalness = 1
    this.roughnessNode = spikes.mul(0.15).add(0.02)
    this.normalNode = flow
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.1
    this.emissiveNode = color(hsl.integer(0, 0, 100)).mul(rim.pow(4)).mul(0.5)
  }
}
