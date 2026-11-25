import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

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
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.7, 2.4).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const lacquer = mx_noise_float(inner.mul(8)).mul(0.5).add(0.5)
    const crystals = filament(mx_noise_float(p.mul(7).add(mx_noise_vec3(p.mul(14)).mul(0.4))), 0.02)
    const buried = filament(mx_noise_float(deep.mul(21)), 0.018)
    const ember = inner.y.mul(11).sub(time.mul(0.55)).sin().mul(0.22).add(0.78)
    const heat = mix(color(hsl.integer(26, 94, 16)), color(hsl.integer(30.3, 100, 58.4)), lacquer.pow(1.35))
    this.colorNode = mix(heat, color(hsl.integer(83, 100, 86.6)), crystals.mul(0.85))
    this.metalnessNode = crystals.mul(0.55)
    this.transmissionNode = crystals.oneMinus().mul(0.42)
    this.thickness = 0.38
    this.ior = 1.64
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(29, 96, 31.6))
    this.attenuationDistance = 0.48
    this.roughnessNode = crystals.oneMinus().mul(0.12).add(0.045)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(18)).add(crystals.mul(0.4)), 0.0032)
    this.clearcoat = 0.95
    this.clearcoatRoughness = 0.035
    this.emissiveNode = color(hsl.integer(37.7, 100, 63)).mul(crystals).mul(ember).mul(near.mul(0.7).add(0.28)).add(color(hsl.integer(71, 100, 79)).mul(buried).mul(intimate).mul(0.9)).add(color(hsl.integer(37, 100, 65.7)).mul(rim).mul(0.22))
  }
}
