import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

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
    const rim = grazing.pow(2)
    // Object-space direction from the surface point to the camera. Drives every
    // angular reaction in this file (parallax, hue shift, fresnel tinting).
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance — fine/deep layers fade in continuously on approach,
    // their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    // Liquid gold surface roiling with plasma. Prominences arc across the
    // form and flare most when seen side-on (high grazing), giving the
    // material a clear reading from every walk-up angle.
    const granule = mx_noise_float(inner.mul(14).add(time.mul(0.12))).mul(0.5).add(0.5)
    const prominence = filament(mx_noise_float(inner.mul(7).add(mx_noise_vec3(inner.mul(4)).mul(0.55))), 0.02)
    const arc = opticalLine(mx_noise_float(deep.mul(15).sub(time.mul(0.22))).mul(2).sub(1), 0.045)
    const gold = mix(color(hsl.integer(50, 100, 43)), color(hsl.integer(86, 100, 86)), granule.pow(0.75))
    this.colorNode = mix(color(hsl.integer(59, 100, 6)), gold, granule.mul(0.8).add(0.1))
    this.metalness = 0.88
    this.roughnessNode = prominence.mul(-0.16).add(0.22)
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.08
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(18)), 0.0018)
    this.emissiveNode = color(hsl.integer(74, 100, 79.2)).mul(prominence).mul(grazing.mul(0.4).add(0.7)).add(color(hsl.integer(99.4, 100, 94.7)).mul(arc).mul(near.mul(0.8).add(0.35))).add(color(hsl.integer(49, 100, 67.9)).mul(granule.pow(3)).mul(0.35)).add(color(hsl.integer(86, 100, 86)).mul(rim).mul(0.3))
  }
}
