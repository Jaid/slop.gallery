import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

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
    // Abyssal nave with god rays refracting through the glass. Shafts are
    // keyed to an object-space axis so their angle and density shift as the
    // visitor circles the knot; close approach draws out suspended dust.
    const column = mx_noise_float(p.mul(4.5)).mul(0.5).add(0.5)
    const shaftDir = vec3(0.32, 1, 0.18).normalize()
    const shaftPhase = inner.dot(shaftDir).mul(5).add(time.mul(0.05))
    const shafts = opticalLine(shaftPhase.sin().mul(inner.y.mul(1.4).add(0.9).clamp()), 0.07)
    const dust = mx_noise_float(inner.mul(19).add(time.mul(0.08))).mul(0.5).add(0.5)
    const relic = filament(mx_noise_float(p.mul(7)), 0.02)
    this.colorNode = mix(color(hsl.integer(240, 80, 9)), color(hsl.integer(240, 85, 28)), column.pow(1.2))
    this.transmission = 0.78
    this.thickness = 0.6
    this.ior = 1.52
    this.attenuationColor.set(hsl.integer(232, 85, 49))
    this.attenuationDistance = 0.7
    this.roughnessNode = dust.mul(0.045).add(0.07)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.05
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(9)), 0.0012)
    this.emissiveNode = color(hsl.integer(212, 99, 86)).mul(shafts).mul(near.mul(0.85).add(0.2)).mul(grazing.mul(0.35).add(0.5)).add(color(hsl.integer(80, 100, 87.2)).mul(relic).mul(near.mul(0.5).add(0.1)).mul(0.5)).add(color(hsl.integer(224, 99, 78)).mul(rim).mul(0.25))
  }
}
