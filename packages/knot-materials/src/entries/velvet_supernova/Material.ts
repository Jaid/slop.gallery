import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const dust = mx_noise_float(inner.mul(7)).mul(0.5).add(0.5)
    const nebula = dust.smoothstep(0.38, 0.76)
    const starlight = opticalLine(mx_noise_float(deep.mul(36)), 0.024).mul(opticalLine(mx_noise_float(deep.mul(39).add(7)), 0.03)).mul(near)
    const flash = view.dot(vec3(0.62, 0.35, 0.7).normalize()).abs().pow(5)
    this.colorNode = mix(color(hsl.integer(306, 66, 8.5)), color(hsl.integer(350, 64, 27)), nebula)
    this.roughnessNode = near.mul(0.1).add(0.62)
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(292, 79, 41.5)), color(hsl.integer(67, 100, 87)), flash)
    this.sheenRoughness = 0.38
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(42)).mul(near), 0.00025)
    this.emissiveNode = mix(color(hsl.integer(322, 70, 31)), color(hsl.integer(51, 90, 70)), flash).mul(nebula).mul(grazing.mul(0.35).add(0.15)).add(color(hsl.integer(73, 100, 91)).mul(starlight).mul(flash.mul(1.8).add(0.3)))
  }
}
