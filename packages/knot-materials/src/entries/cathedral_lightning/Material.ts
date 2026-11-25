import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Clear quartz trapping a storm that seeks the viewer - random strikes with exponential decay */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, rim, near} = viewerFrame()
    const tick = time.mul(6.5).floor()
    const tickFract = time.mul(6.5).fract()
    const jitter = cellNoiseVec3(vec3(tick.mul(0.31), tick.mul(0.47), float(2.1)))
    const strikeChance = jitter.x.smoothstep(0.68, 0.84)
    const inner = p.sub(view.mul(0.18))
    const stormField = mx_fractal_noise_float(inner.mul(3.2).add(vec3(time.mul(0.3), float(0), float(0))), 3, 2, 0.5)
    const stormField2 = mx_noise_float(inner.mul(7.5).add(time.mul(0.6)))
    const trunk = filament(stormField.sub(0.15), 0.03)
    const branches = filament(stormField2.sub(0.1), 0.018).mul(0.7)
    const lightningMask = trunk.max(branches).mul(strikeChance)
    const flash = tickFract.oneMinus().pow(3).mul(strikeChance).add(strikeChance.mul(0.15))
    this.colorNode = color(hsl.integer(250, 100, 96))
    this.transmission = 0.96
    this.thickness = 0.75
    this.ior = 1.54
    this.dispersion = 0.12
    this.attenuationColor.set(hsl.integer(247, 100, 91))
    this.attenuationDistance = 0.9
    this.roughness = 0.015
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(stormField.mul(0.2), 0.0008)
    this.emissiveNode = mix(color(hsl.integer(203, 100, 86.8)), color(hsl.integer(304, 100, 62.6)), stormField2.mul(0.5).add(0.5)).mul(lightningMask).mul(flash).mul(6)
      .add(color(hsl.integer(0, 0, 100)).mul(lightningMask).mul(flash).mul(2.5).mul(near.mul(0.5).add(0.5)))
      .add(color(hsl.integer(263, 100, 69)).mul(rim.pow(5).mul(0.2)))
    this.envMapIntensity = 0.7
  }
}
