import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
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
    const intimate = positionView.length().smoothstep(0.7, 2.4).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const scale = mx_noise_float(p.mul(4.5)).mul(0.5).add(0.5)
    const slag = filament(mx_noise_float(inner.mul(9).add(mx_noise_vec3(p.mul(5)).mul(0.55))), 0.03)
    const pores = opticalLine(mx_noise_float(deep.mul(28)), 0.02)
    const bloom = scale.smoothstep(0.42, 0.78)
    const drift = inner.add(vec3(time.mul(0.03), time.mul(-0.02), 0))
    const stars = opticalLine(mx_noise_float(drift.mul(34)), 0.016).mul(opticalLine(mx_noise_float(drift.mul(41).add(5)), 0.022))
    const flare = view.dot(vec3(0.28, 0.82, 0.48).normalize()).abs().pow(6)
    this.colorNode = mix(color(hsl.integer(301, 24, 5)), mix(color(hsl.integer(338, 11, 17)), color(hsl.integer(350, 44, 33)), bloom), slag.oneMinus())
    this.metalnessNode = slag.oneMinus().mul(0.86).add(0.08)
    this.roughnessNode = slag.mul(0.38).add(near.mul(-0.04)).add(0.22)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(26)).mul(slag.add(0.15)), 0.0024)
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.18
    this.sheen = 0.7
    this.sheenNode = mix(color(hsl.integer(329, 68, 21)), color(hsl.integer(343, 100, 75)), flare)
    this.sheenRoughness = 0.42
    this.emissiveNode = mix(color(hsl.integer(320, 77, 31)), color(hsl.integer(341, 100, 70)), flare).mul(bloom).mul(slag).mul(grazing.mul(0.45).add(0.18)).add(color(hsl.integer(325, 100, 93)).mul(stars).mul(near).mul(flare.mul(1.6).add(0.35))).add(color(hsl.integer(289, 100, 48.6)).mul(pores).mul(intimate).mul(0.55))
  }
}
