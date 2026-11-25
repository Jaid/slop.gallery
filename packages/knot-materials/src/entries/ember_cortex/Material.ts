import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, near, intimate, rim} = viewerFrame()
    const warp = mx_noise_float(p.mul(1.6)).mul(0.4)
    const q = p.mul(2.1).add(warp.mul(vec3(0.9, 1.15, 0.8)))
    const ridge = mx_noise_float(q).abs()
    const crack = filament(ridge, 0.028)
    const fine = filament(mx_noise_float(q.mul(2.9).add(vec3(4.2))).abs(), 0.014)
    const network = crack.max(fine.mul(0.55)).clamp()
    const halo = filament(ridge, 0.22).mul(0.5)
    const heat = mx_noise_float(q.mul(0.8).add(vec3(3.7))).mul(0.5).add(0.5)
    const pulse = time.mul(0.9).add(heat.mul(6.283)).sin().mul(0.14).add(0.86)
    const flicker = mx_noise_float(vec3(p.x.mul(2.5), p.y.mul(2.5), time.mul(2.4))).mul(0.3).add(0.7)
    const lavaColor = mix(mix(color(hsl.integer(33, 93, 11)), color(hsl.integer(36.5, 100, 61.4)), heat.smoothstep(0.2, 0.62)), color(hsl.integer(89, 100, 87.4)), heat.smoothstep(0.62, 0.95))
    const eq = q.mul(26)
    const er = cellNoiseVec3(eq)
    const ed = eq.fract().sub(er.mul(0.5).add(0.25)).length()
    const ef = eq.fwidth().length().max(0.001)
    const ember = ed.smoothstep(0.03, ef.add(0.045)).oneMinus().mul(er.z.smoothstep(0.62, 0.68))
    const emberTwinkle = time.mul(er.y.mul(6).add(2)).add(er.x.mul(20)).sin().mul(0.4).add(0.6)
    this.colorNode = mix(color(hsl.integer(274, 13, 7)), color(hsl.integer(37, 41, 8)), halo.add(network.mul(0.6)).clamp())
    this.metalness = 0
    this.roughnessNode = float(0.1).mix(0.55, network.add(halo).clamp())
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(network.mul(-1.2).add(mx_noise_float(p.mul(9)).mul(0.2)), 0.003)
    this.emissiveNode = lavaColor.mul(network).mul(pulse).mul(flicker).mul(near.mul(0.5).add(0.5)).mul(2.2)
      .add(lavaColor.mul(halo).mul(0.22).mul(pulse))
      .add(color(hsl.integer(51, 100, 71)).mul(network).mul(rim).mul(0.4))
      .add(color(hsl.integer(77, 100, 85)).mul(ember).mul(emberTwinkle).mul(network).mul(intimate).mul(2))
  }
}
