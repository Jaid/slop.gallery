import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, time} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, intimate} = viewerFrame()
    const cloudNoise = mx_fractal_noise_float(p.mul(4).add(time.mul(0.2)), 3, 2, 0.5).mul(0.5).add(0.5)
    const cloudDensity = cloudNoise.smoothstep(0.3, 0.7)
    const collapse = intimate
    const cloudColor = mix(color(hsl.integer(248, 99, 68)), color(hsl.integer(202, 100, 85)), cloudNoise)
    const cloudEmissive = cloudColor.mul(cloudDensity).mul(3)
    const chromeColor = color(hsl.integer(0, 0, 100))
    this.colorNode = mix(cloudColor, chromeColor, collapse)
    this.metalnessNode = collapse
    this.roughnessNode = mix(1, 0, collapse)
    // The source alpha/transmission combination triggers a Tint swizzle-lowering bug;
    // retain the cloud-to-chrome collapse through surface response instead.
    this.clearcoatNode = collapse.mul(0.8)
    this.clearcoatRoughnessNode = collapse.mul(0.06).add(0.18)
    this.side = DoubleSide
    this.emissiveNode = cloudEmissive.mul(collapse.oneMinus())
  }
}
