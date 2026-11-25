import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, rim, near, intimate} = viewerFrame()
    const crackle = mx_worley_noise_float(p.mul(5.5).add(vec3(0, time.mul(0.04), 0)))
    const cracks = opticalLine(crackle.sub(0.26), 0.007).mul(intimate.mul(0.5).add(0.7))
    const porcelain = mix(color(hsl.integer(87, 26, 95)), color(hsl.integer(75, 18, 83)), mx_noise_float(p.mul(2.5)).mul(0.3).add(0.5))
    this.colorNode = mix(porcelain, color(hsl.integer(84, 66, 81)), cracks)
    this.metalness = 0.04
    this.metalnessNode = cracks.mul(0.96)
    this.roughnessNode = mix(float(0.28), float(0.1), cracks)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.028
    this.normalNode = proceduralNormal(cracks.mul(0.8), 0.0006)
    const soulGlow = cracks.mul(near.mul(0.75).add(0.45)).mul(time.mul(0.9).sin().mul(0.15).add(0.95))
    this.emissiveNode = color(hsl.integer(69, 100, 79.5)).mul(soulGlow).mul(1.7).add(color(hsl.integer(45, 100, 65)).mul(cracks.pow(2)).mul(0.9)).add(porcelain.mul(rim).mul(0.12))
  }
}
