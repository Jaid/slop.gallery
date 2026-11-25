import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // Brushed grain: very high frequency along the tube, stretched across it.
    const grain = mx_noise_float(vec3(tube.x.mul(420), tube.y.mul(9), 0))
    const voltage = mx_fractal_noise_float(p.mul(1.6), 4, 2, 0.5).mul(0.5).add(0.5)
    // Quantised anodising zones with soft borders, like stepped bath voltages.
    const steps = voltage.mul(3)
    const zones = steps.floor().add(steps.fract().smoothstep(0.42, 0.58)).div(3)
    const base = mix(color(hsl.integer(256, 11, 47)), color(hsl.integer(248, 13, 79)), grain.mul(0.5).add(0.5))
    this.colorNode = mix(base, color(hsl.integer(256, 32, 67)), zones.mul(0.35))
    this.metalness = 1
    this.roughnessNode = grain.abs().mul(0.14).add(0.05)
    this.anisotropy = 0.85
    this.anisotropyRotation = 1.5708
    this.iridescence = 1
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = zones.mul(520).add(grain.mul(40)).add(180)
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(grain, 0.0006)
    this.emissiveNode = color(hsl.integer(260, 100, 71.4)).mul(grazing.pow(4)).mul(0.22)
  }
}
