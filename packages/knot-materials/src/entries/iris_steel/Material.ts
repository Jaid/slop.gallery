import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
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
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const glance = grazing.pow(2.4)
    const fold = mx_noise_float(inner.mul(6.5)).add(p.y.mul(2.2))
    const damascus = opticalBands(fold.mul(18)).mul(0.65).add(opticalBands(fold.mul(41)).mul(0.35))
    const lock = view.dot(normalLocal.normalize()).abs().smoothstep(0.18, 0.62)
    const slick = spectralColor(fold.mul(5.5).add(view.x.mul(7)).add(view.z.mul(3)).add(time.mul(0.05)))
    const micro = opticalLine(mx_noise_float(deep.mul(40)), 0.018).mul(near)
    const bevel = glance.pow(1.6)
    this.colorNode = mix(color(hsl.integer(258, 17, 10)), mix(color(hsl.integer(256, 15, 29)), slick, lock.mul(0.55)), damascus)
    this.metalness = 1
    this.roughnessNode = damascus.oneMinus().mul(0.07).add(near.mul(-0.02)).add(0.08)
    this.iridescence = 1
    this.iridescenceIOR = 1.28
    this.iridescenceThicknessNode = fold.mul(90).add(lock.mul(260)).add(220)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.normalNode = proceduralNormal(damascus.mul(0.35).add(mx_noise_float(p.mul(48)).mul(near).mul(0.2)), 0.0011)
    this.emissiveNode = slick.mul(bevel).mul(lock).mul(near.mul(0.45).add(0.12)).add(color(hsl.integer(261, 100, 92)).mul(micro).mul(0.35)).add(color(hsl.integer(271, 100, 62)).mul(rim).mul(0.08))
  }
}
