import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, sin, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, rim, intimate} = viewerFrame()
    const scalePos = p.mul(12).add(vec3(0, time.mul(0.1), 0))
    // Fractal octaves can exceed [-1, 1]; bound the mask before pow and material inputs.
    const scales = mx_fractal_noise_float(scalePos, 3, 2, 0.5).mul(0.5).add(0.5).clamp().pow(3)
    const scaleNormal = proceduralNormal(scales, 0.05)
    const iridescence = mix(color(hsl.integer(269, 58, 9)), color(hsl.integer(233, 82, 45)), facing.mul(scales))
    const deepGlow = mix(color(hsl.integer(171, 100, 87)), color(hsl.integer(350, 100, 60.4)), sin(time.mul(0.5).add(p.y.mul(3))).mul(0.5).add(0.5))
    const pulse = sin(time.mul(2).add(p.dot(vec3(1, 2, 3)).mul(5))).mul(0.5).add(0.5)
    const bioLuminescence = deepGlow.mul(pulse).mul(intimate.mul(0.8).add(0.2)).mul(scales.oneMinus())
    this.colorNode = mix(iridescence, color(hsl.integer(262, 45, 3.3)), scales)
    this.metalness = 0.4
    this.roughnessNode = scales.mul(0.3).add(0.2)
    this.normalNode = scaleNormal
    this.anisotropyNode = scales
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.1
    this.emissiveNode = bioLuminescence.mul(2.5).add(rim.mul(color(hsl.integer(262.6, 100, 46))).mul(0.3))
    this.sheen = 1
    this.sheenRoughness = 0.4
    this.sheenNode = color(hsl.integer(242, 100, 66))
  }
}
