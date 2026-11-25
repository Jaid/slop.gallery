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
    const noise = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
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
    // Black volcanic glass with a lattice of molten seams. Fissure heat is
    // amplified at grazing angles so peering around the silhouette reveals
    // the deepest embers — a real reward for walking off-axis.
    const cracks = mx_noise_float(p.mul(3.2).add(mx_noise_vec3(p.mul(7)).mul(0.45)))
    const seam = filament(cracks, 0.013)
    const fork = filament(mx_noise_float(p.mul(9).add(3)), 0.018)
    const ember = mx_noise_float(inner.mul(8).add(time.mul(0.06))).mul(0.5).add(0.5)
    const heat = seam.add(fork.mul(0.6)).mul(near.mul(0.55).add(0.45)).mul(ember.pow(2))
    const molten = mix(color(hsl.integer(37.7, 100, 63)), color(hsl.integer(90, 100, 90)), ember)
    this.colorNode = mix(color(hsl.integer(302, 35, 4)), color(hsl.integer(43, 60, 7.5)), noise.mul(0.6))
    this.metalnessNode = seam.oneMinus().mul(0.15).add(0.15)
    this.roughnessNode = seam.mul(-0.4).add(0.55)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(18)), 0.0018)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.emissiveNode = molten.mul(heat).mul(grazing.mul(0.45).add(0.6)).add(molten.mul(rim).mul(0.35))
  }
}
