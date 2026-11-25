import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, intimate} = viewerFrame()
    const oxidation = mx_fractal_noise_float(p.mul(3.2).add(vec3(0, time.mul(0.06), 0)), 3, 2, 0.5).mul(0.5).add(0.5)
    const heat = oxidation.smoothstep(0.52, 0.82)
    const temper = mix(color(hsl.integer(251, 25, 21)), color(hsl.integer(49, 100, 67.9)), heat)
    const temper2 = mix(temper, color(hsl.integer(286, 99, 53)), heat.pow(3))
    const cracks = opticalLine(mx_worley_noise_float(p.mul(5.5)).sub(0.32), 0.014).mul(intimate.mul(0.7).add(0.3))
    this.envMapIntensity = 1.5
    this.colorNode = temper2
    this.metalness = 1
    this.roughnessNode = mx_noise_float(p.mul(12)).mul(0.03).add(0.015).add(grazing.mul(0.01))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(18)), 0.0007)
    this.iridescence = 0.25
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = oxidation.mul(380).add(120)
    this.emissiveNode = color(hsl.integer(32.7, 100, 59)).mul(cracks).mul(heat).mul(2.2).add(color(hsl.integer(258, 100, 58)).mul(grazing.pow(4)).mul(0.5))
  }
}
