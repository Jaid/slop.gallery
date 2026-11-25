import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec4} from 'three/tsl'

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
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const inclusions = mx_noise_float(inner.mul(12)).mul(0.5).add(0.5)
    const veins = filament(mx_noise_float(p.mul(4).add(mx_noise_vec3(p.mul(8)).mul(0.35))), 0.022)
    const deepVeins = filament(mx_noise_float(deep.mul(17)), 0.025)
    this.colorNode = mix(mix(color(hsl.integer(161, 94, 44.6)), color(hsl.integer(152, 63, 71)), inclusions), color(hsl.integer(85, 75, 77.5)), veins)
    this.metalnessNode = veins.mul(0.9)
    this.transmissionNode = veins.oneMinus().mul(0.78)
    this.thickness = 0.4
    this.ior = 1.58
    this.dispersion = 0.22
    this.attenuationColor.set(hsl.integer(158, 98.6, 42))
    this.attenuationDistance = 0.55
    this.roughnessNode = veins.mul(0.1).add(0.065)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(12)), 0.004)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.055
    this.emissiveNode = color(hsl.integer(158, 83, 78)).mul(deepVeins).mul(veins.oneMinus()).mul(near).mul(grazing.mul(0.3).add(0.12))
  }
}
