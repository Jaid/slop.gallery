import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, rim, near, intimate} = viewerFrame()
    const fuzz = mx_noise_float(p.mul(35)).mul(0.12)
    const veinField = mx_worley_noise_float(p.mul(7).add(vec3(0, 0, time.mul(0.08))))
    const veins = opticalLine(veinField.sub(0.27), 0.012).mul(intimate.mul(0.85).add(0.15))
    const filigree = veins.mul(rim.mul(1.2).add(0.2))
    this.envMapIntensity = 0.12
    this.colorNode = color(hsl.integer(0, 0, 0))
    this.roughness = 0.98
    this.metalness = 0
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.9
    this.normalNode = proceduralNormal(fuzz, 0.0004)
    this.emissiveNode = color(hsl.integer(14, 99, 59)).mul(filigree).mul(1.5).add(color(hsl.integer(282, 100, 41.3)).mul(veins.mul(grazing.pow(3)).mul(0.7))).mul(near.mul(0.6).add(0.5))
  }
}
