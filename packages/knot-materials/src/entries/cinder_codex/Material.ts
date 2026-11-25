import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Obsidian with molten gold kintsugi - cracks breathe heat */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, rim, near} = viewerFrame()
    const heatPulse = time.mul(1.1).sin().mul(0.3).add(0.7)
    const baseNoise = mx_noise_float(p.mul(2.2))
    const worleyLarge = mx_worley_noise_float(p.mul(5.5))
    const worleySmall = mx_worley_noise_float(p.mul(18).add(vec3(4.2, 1.3, 2.8)))
    const crackLarge = worleyLarge.smoothstep(0.78, 0.92)
    const crackSmall = worleySmall.smoothstep(0.72, 0.88)
    const crackMask = crackLarge.max(crackSmall.mul(0.6))
    const crackCore = worleyLarge.smoothstep(0.86, 0.9).add(worleySmall.smoothstep(0.82, 0.86).mul(0.5))
    const flow = mx_noise_float(p.mul(3).add(vec3(time.mul(0.2), float(0), float(0)))).mul(0.5).add(0.5)
    const moltenGold = mix(color(hsl.integer(45, 100, 65)), color(hsl.integer(96, 100, 87)), flow)
    const ember = mix(color(hsl.integer(30.3, 100, 57.5)), color(hsl.integer(83, 100, 85)), flow)
    const obsidian = mix(color(hsl.integer(286, 8, 5)), color(hsl.integer(286, 9, 12)), baseNoise.mul(0.2).add(facing.mul(0.2)))
    this.colorNode = mix(obsidian, moltenGold, crackMask)
    this.metalnessNode = crackMask.mul(0.85).add(0.05)
    this.roughnessNode = float(0.08).mix(0.75, crackMask.oneMinus()).add(crackMask.mul(0.05))
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(crackMask.mul(1.2).add(baseNoise.mul(0.2)), 0.0015)
    this.emissiveNode = moltenGold.mul(crackCore).mul(heatPulse).mul(1.8)
      .add(ember.mul(crackMask).mul(0.4))
      .add(color(hsl.integer(37, 100, 61.4)).mul(rim.pow(3).mul(crackMask).mul(0.25)))
      .mul(near.mul(0.5).add(0.5))
    this.envMapIntensity = 0.5
  }
}
