import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const noise = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.7, 2.4).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const orbit = view.x.mul(0.55).add(view.y.mul(0.35)).add(0.5)
    const glance = grazing.pow(2.4)
    const radius = inner.xz.length().add(inner.y.mul(0.22))
    const pulse = radius.mul(8).sub(time.mul(0.16)).sin().mul(0.04)
    const corona = opticalLine(radius.add(pulse).mul(64).sin(), 0.07)
    const innerRing = opticalLine(deep.xz.length().add(deep.y.mul(0.18)).mul(88).sin(), 0.055)
    const umbra = radius.smoothstep(0.08, 0.38).oneMinus()
    const bone = mix(color(hsl.integer(72, 23, 75)), color(hsl.integer(65, 12, 43)), noise.mul(grazing.mul(0.5).add(0.35)))
    const fire = mix(color(hsl.integer(41, 100, 65.4)), color(hsl.integer(90, 100, 90)), facing.mul(orbit).clamp())
    this.colorNode = mix(color(hsl.integer(310, 35, 4)), bone, rim.mul(0.85).add(0.08))
    this.metalnessNode = umbra.mul(0.35).add(0.12)
    this.roughnessNode = umbra.oneMinus().mul(0.28).add(near.mul(-0.03)).add(0.14)
    this.transmissionNode = umbra.mul(0.22)
    this.thickness = 0.36
    this.ior = 1.46
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.07
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(16)).mul(0.5).add(corona.mul(0.3)), 0.0018)
    this.sheen = 0.55
    this.sheenNode = mix(color(hsl.integer(38, 43, 17)), color(hsl.integer(67, 100, 87)), glance)
    this.sheenRoughness = 0.3
    this.emissiveNode = fire.mul(corona).mul(umbra.mul(0.25).add(0.55)).mul(near.mul(0.6).add(0.4)).add(color(hsl.integer(56, 100, 74)).mul(innerRing).mul(intimate).mul(umbra.oneMinus()).mul(0.45)).add(color(hsl.integer(69, 100, 87.2)).mul(rim.pow(2.4)).mul(0.28))
  }
}
