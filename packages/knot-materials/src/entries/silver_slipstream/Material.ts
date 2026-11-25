import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
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
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    // Ripples sleep at a distance and wake as you approach.
    this.colorNode = mix(color(hsl.integer(253, 25, 93.5)), color(hsl.integer(248, 22, 84)), noise)
    this.metalness = 1
    this.roughness = 0.035
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.02
    this.normalNode = liquidNormal(near.mul(0.85).add(0.15), 0.38)
    this.emissiveNode = color(hsl.integer(254, 100, 80)).mul(rim.pow(3)).mul(0.16)
    this.envMapIntensity = 1.3
  }
}
