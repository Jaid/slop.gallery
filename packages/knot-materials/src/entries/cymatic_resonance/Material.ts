import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, sin, time} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, intimate} = viewerFrame()
    const t = time.mul(0.15)
    const freq1 = 3
    const freq2 = 4
    const freq3 = 5
    const wave1 = sin(p.x.mul(freq1).add(t))
    const wave2 = sin(p.y.mul(freq2).add(t.mul(1.3)))
    const wave3 = sin(p.z.mul(freq3).add(t.mul(0.7)))
    const interference = wave1.add(wave2).add(wave3).div(3)
    const sandMask = float(1).sub(interference.abs().smoothstep(0, 0.05)).pow(2)
    const sandNormal = proceduralNormal(sandMask, 0.02)
    const baseColor = mix(color(hsl.integer(37, 42, 12)), color(hsl.integer(49, 54, 22)), mx_noise_float(p.mul(20)))
    const sandColor = color(hsl.integer(91, 82, 73))
    this.colorNode = mix(baseColor, sandColor, sandMask)
    this.metalnessNode = sandMask.mul(0.8)
    this.roughnessNode = mix(0.8, 0.3, sandMask)
    this.normalNode = sandNormal
    this.emissiveNode = sandColor.mul(sandMask).mul(intimate.mul(0.8).add(0.2)).mul(1.5)
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.4
  }
}
