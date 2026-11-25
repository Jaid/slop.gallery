import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_rotate2d, positionGeometry, uv} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const tube = uv()
    const rot = (mx_rotate2d(tube.sub(0.5), 0.785) as unknown as Node<'vec2'>).add(0.5)
    const weaveA = rot.x.mul(40).fract().sub(0.5).abs().smoothstep(0, 0.3)
    const weaveB = rot.y.mul(40).fract().sub(0.5).abs().smoothstep(0, 0.3)
    const weave = weaveA.mul(weaveB)
    const p = positionGeometry
    const grain = mx_noise_float(p.mul(20)).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(286, 6, 7)), color(hsl.integer(286, 6, 25)), weave.mul(grain))
    this.metalness = 0.9
    this.roughnessNode = weave.mul(0.15).add(0.2)
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.1
    this.normalNode = proceduralNormal(weave, 0.0009)
    this.iridescence = 0.4
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = weave.mul(260).add(100)
  }
}
