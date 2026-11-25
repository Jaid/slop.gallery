import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near} = viewerFrame()
    const flowUv = p.mul(2.2).add(vec3(time.mul(0.18), time.mul(-0.12), time.mul(0.1)))
    const flow = mx_fractal_noise_float(flowUv, 3, 2, 0.5).mul(0.5).add(0.5)
    const rippleH = mx_noise_float(p.mul(14).add(vec3(time.mul(0.6), 0, time.mul(0.4)))).mul(0.5).add(flow.mul(0.7))
    const bandsPhase = p.y.mul(7).add(flow.mul(5)).add(view.x.mul(4)).add(view.z.mul(3)).add(time.mul(0.25))
    const aurora = opticalBands(bandsPhase)
    const aurora2 = opticalBands(bandsPhase.mul(1.7).add(2.1))
    const auroraTint = mix(mix(color(hsl.integer(162, 100, 86.4)), color(hsl.integer(288, 100, 51)), aurora), color(hsl.integer(340, 100, 70)), aurora2.mul(0.6))
    this.colorNode = mix(color(hsl.integer(256, 10, 66)), auroraTint, aurora.mul(0.22).add(rim.mul(0.25)))
    this.metalness = 1
    this.roughnessNode = float(0.06).add(flow.mul(0.08)).add(grazing.mul(0.05))
    this.envMapIntensity = 1.5
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 1
    this.iridescenceIOR = 1.9
    this.iridescenceThicknessNode = flow.mul(500).add(facing.mul(200)).add(120)
    this.anisotropy = 0.85
    this.normalNode = proceduralNormal(rippleH, 0.004)
    this.emissiveNode = auroraTint.mul(aurora).mul(rim.mul(1.2).add(0.25)).mul(1.1).mul(near.mul(0.5).add(0.7)).add(color(hsl.integer(171, 100, 87)).mul(grazing.pow(3)).mul(0.5))
  }
}
