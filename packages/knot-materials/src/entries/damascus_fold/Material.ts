import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // Pattern-welded billet: a stack of planar layers distorted by low-frequency folding.
    const warp = mx_fractal_noise_float(p.mul(1.6), 4, 2, 0.5)
    const layers = p.dot(vec3(0.2, 1, 0.35)).mul(26).add(warp.mul(5.5))
    const bands = layers.sin().mul(0.5).add(0.5)
    const etch = bands.smoothstep(0.3, 0.7)
    const grain = mx_noise_float(p.mul(38)).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(273, 13, 16)), color(hsl.integer(88, 18, 84)), etch).mul(grain.mul(0.12).add(0.94))
    this.metalness = 1
    this.roughnessNode = etch.mul(-0.26).add(0.4).add(grain.mul(0.03)).sub(grazing.mul(0.05)).clamp(0.04, 0.6)
    this.anisotropy = 0.7
    this.anisotropyRotation = 1.2
    this.normalNode = proceduralNormal(bands.mul(0.6).add(grain.mul(0.1)), 0.0016)
    this.iridescence = 0.18
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = etch.mul(260).add(180)
    this.emissiveNode = color(hsl.integer(275, 100, 67)).mul(grazing.pow(5)).mul(0.12)
  }
}
