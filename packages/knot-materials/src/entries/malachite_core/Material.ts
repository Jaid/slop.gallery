import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // Botryoidal banding: contour the noise field into concentric rings.
    const field = mx_fractal_noise_float(p.mul(1.5), 5, 2.1, 0.55)
    const rings = field.mul(16).sin().mul(0.5).add(0.5)
    const tight = field.mul(38).sin().mul(0.5).add(0.5).mul(0.35)
    const banding = rings.mul(0.8).add(tight).clamp()
    const seam = opticalLine(rings.sub(0.5), 0.05).mul(0.6)
    const grit = mx_noise_float(p.mul(40)).mul(0.5).add(0.5)
    const dark = mix(color(hsl.integer(163, 71, 8)), color(hsl.integer(158, 94, 30)), banding.pow(2))
    const bright = mix(dark, color(hsl.integer(158, 65, 78.5)), banding.smoothstep(0.55, 0.98))
    this.colorNode = mix(bright, color(hsl.integer(160, 49, 92.7)), seam.mul(0.35)).mul(grit.mul(0.08).add(0.96))
    this.metalness = 0
    this.roughnessNode = banding.oneMinus().mul(0.09).add(grit.mul(0.03)).add(0.05)
    this.ior = 1.66
    this.specularIntensity = 1
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(banding.mul(0.5).add(grit.mul(0.15)), 0.0012)
    this.emissiveNode = color(hsl.integer(157, 94, 77)).mul(seam).mul(0.12).add(color(hsl.integer(161, 100, 92.2)).mul(grazing.pow(5)).mul(0.14))
  }
}
