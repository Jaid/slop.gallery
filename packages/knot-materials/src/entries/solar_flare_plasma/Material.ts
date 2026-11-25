import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_fractal_noise_float, positionGeometry, sin, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const p = positionGeometry
    const flow = mx_fractal_noise_float(p.mul(3).add(time.mul(0.05)), 4, 2.2, 0.55)
    const bands = opticalBands(flow.mul(6).add(time.mul(0.2)))
    const flicker = sin(time.mul(2.3).add(flow.mul(9))).mul(0.5).add(0.5)
    const chroma = spectralColor(flow.mul(3).add(time.mul(0.12)))
    this.colorNode = color(hsl.integer(45, 100, 6))
    this.roughness = 0.4
    this.metalness = 0
    this.clearcoat = 0.2
    this.normalNode = proceduralNormal(flow, 0.001)
    this.emissiveNode = chroma.mul(bands).mul(flicker.mul(0.6).add(0.7)).mul(2.4).add(color(hsl.integer(83, 100, 85)).mul(flow.smoothstep(0.55, 0.9)).mul(1.2))
  }
}
