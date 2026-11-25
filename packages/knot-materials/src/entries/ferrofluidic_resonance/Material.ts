import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, time, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, intimate} = viewerFrame()
    const noiseField = mx_fractal_noise_float(p.mul(8).add(vec3(0, time.mul(0.3), 0)), 4, 2, 0.5)
    const spikeMask = noiseField.smoothstep(0.2, 0.6)
    const spikeNormal = proceduralNormal(noiseField, 0.15)
    const baseColor = color(hsl.integer(0, 0, 3.7))
    const tipColor = cosinePalette(noiseField.mul(2), [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1, 1, 1], [0, 0.33, 0.67])
    this.colorNode = mix(baseColor, tipColor, spikeMask.mul(0.6))
    this.metalness = 1
    this.roughnessNode = spikeMask.oneMinus().mul(0.05).add(0.01)
    this.normalNode = spikeNormal
    this.envMapIntensity = 1.5
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.05
    this.emissiveNode = tipColor.mul(spikeMask).mul(grazing.pow(3)).mul(intimate.mul(0.5).add(0.5)).mul(0.8)
  }
}
