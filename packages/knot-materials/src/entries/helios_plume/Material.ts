import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

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
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    // Granulated chromosphere; surface arcs stay put while buried flares
    // parallax under the skin, and the limb burns at grazing angles.
    const churn = mx_noise_float(inner.mul(9).add(vec3(0, time.mul(0.05), 0))).mul(0.5).add(0.5)
    const granules = churn.smoothstep(0.35, 0.75)
    const arcs = opticalLine(mx_noise_float(p.mul(6).add(mx_noise_vec3(p.mul(11)).mul(0.5))), 0.02)
    const flares = opticalLine(mx_noise_float(deep.mul(14).sub(vec3(0, time.mul(0.03), 0))), 0.03).mul(near)
    this.colorNode = mix(mix(color(hsl.integer(29, 94, 13)), color(hsl.integer(34, 99.5, 46)), granules), color(hsl.integer(74, 100, 79.2)), arcs.mul(0.8))
    this.transmission = 0.35
    this.thickness = 0.42
    this.ior = 1.55
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(36.6, 100, 51))
    this.attenuationDistance = 0.5
    this.roughnessNode = granules.mul(0.12).add(0.14)
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.08
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(14)), 0.003)
    this.emissiveNode = mix(color(hsl.integer(40.1, 100, 63)), color(hsl.integer(94, 100, 90.2)), granules).mul(arcs.mul(1.3).add(granules.mul(0.35))).mul(near.mul(0.5).add(0.55)).add(color(hsl.integer(54, 100, 70.8)).mul(flares).mul(0.9)).add(color(hsl.integer(34, 100, 59.7)).mul(rim).mul(grazing).mul(0.5))
  }
}
