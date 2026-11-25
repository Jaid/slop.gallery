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
    const inner = p.sub(view.mul(0.17))
    // Repair seams run molten gold; their color tilts from deep bronze to
    // white-hot as facing rises, and buried veins glint on close inspection.
    const lacquer = mx_noise_float(p.mul(6)).mul(0.5).add(0.5)
    const seams = filament(mx_noise_float(p.mul(4).add(mx_noise_vec3(p.mul(7)).mul(0.3))), 0.018)
    const goldDepth = filament(mx_noise_float(inner.mul(9).add(13)), 0.02)
    const pour = time.mul(0.2).sin().mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(0, 0, 3.7)), color(hsl.integer(59, 13, 9)), lacquer)
    this.metalnessNode = seams.mul(0.95)
    this.roughnessNode = seams.oneMinus().mul(0.06).add(seams.mul(0.18).add(0.03))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.028
    this.normalNode = proceduralNormal(seams.mul(0.5).add(mx_noise_float(p.mul(24)).mul(0.1)), 0.003)
    this.emissiveNode = mix(color(hsl.integer(74, 88, 63)), color(hsl.integer(94, 100, 93.8)), facing.pow(3)).mul(seams).mul(pour.mul(0.2).add(0.75)).add(color(hsl.integer(74, 100, 79.2)).mul(goldDepth).mul(seams.oneMinus()).mul(near).mul(0.5)).add(color(hsl.integer(86, 100, 90.7)).mul(rim.pow(2)).mul(0.15))
  }
}
