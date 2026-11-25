import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.4
    const {p, grazing, rim, intimate} = viewerFrame()
    const granule = mx_fractal_noise_float(p.mul(18), 3, 2, 0.55)
    const granule2 = mx_noise_float(p.mul(42).add(time.mul(0.06)))
    const field = mx_noise_float(p.mul(6).add(vec3(time.mul(0.05), 0, time.mul(-0.04))))
    const loop = opticalLine(field.mul(16).sin(), 0.04)
    const plasma = granule.mul(0.5).add(granule2.mul(0.25)).add(0.35)
    const heat = plasma.mul(0.8).add(loop.mul(0.9))
    const fire = mix(color(hsl.integer(32.4, 100, 28)), color(hsl.integer(49, 100, 67.9)), heat.clamp()).add(color(hsl.integer(96, 100, 94.8)).mul(heat.max(0).pow(3)).mul(0.6))
    this.colorNode = fire
    this.metalness = 0
    this.roughnessNode = heat.mul(-0.3).add(0.65)
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.4
    this.normalNode = proceduralNormal(granule.mul(0.5).add(granule2.mul(0.3)), 0.004)
    this.emissiveNode = fire.mul(0.4).add(color(hsl.integer(49, 100, 67.9)).mul(loop).mul(1.2)).add(color(hsl.integer(96, 100, 94.8)).mul(plasma.abs().pow(2)).mul(0.8)).add(color(hsl.integer(72, 100, 79.1)).mul(rim).mul(grazing).mul(0.6)).add(color(hsl.integer(37, 100, 61.4)).mul(granule2.smoothstep(0.6, 0.9)).mul(intimate).mul(0.5))
  }
}
