import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec2, vec3} from 'three/tsl'

import {opticalBands, proceduralNormal, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = data.id
    const {p, view, near, grazing} = viewerFrame()
    // A solid burl, not a UV decal: every side cuts a different section of the same growth rings.
    const warp = mx_noise_float(p.mul(3.8)).mul(0.16)
    const axis = vec2(p.x.add(p.z.mul(0.24)).add(warp), p.y.mul(0.8).sub(p.z.mul(0.17)))
    const radius = axis.length().add(mx_noise_float(p.mul(8)).mul(0.018))
    const growth = radius.mul(155).add(mx_noise_float(p.mul(13)).mul(1.8))
    const latewood = opticalBands(growth).pow(5)
    const fine = opticalBands(growth.mul(3).add(mx_noise_float(p.mul(25)).mul(2)))
    const curl = mx_noise_float(p.mul(vec3(9, 9, 2))).mul(0.5).add(0.5)
    const chatoyance = growth.mul(0.17).add(view.x.mul(8)).add(view.y.mul(5)).sin().mul(0.5).add(0.5)
    const timber = mix(color(hsl.integer(29, 57, 13)), color(hsl.integer(43, 71, 48.5)), curl.mul(0.6).add(chatoyance.mul(0.4)))
    const summer = mix(timber, color(hsl.integer(71, 67, 75)), chatoyance.pow(4).mul(0.4))
    const grain = mix(summer, color(hsl.integer(27, 57, 12.5)), latewood.mul(0.76)).mul(fine.mul(0.1).add(0.9))
    // Long, dark pores break up the varnish only at inspection distance.
    const pores = mx_noise_float(p.mul(vec3(130, 130, 20))).smoothstep(0.45, 0.72).mul(near)
    this.colorNode = mix(grain, color(hsl.integer(34, 36, 8)), pores.mul(0.65))
    this.metalness = 0.05
    this.roughnessNode = latewood.mul(0.09).add(pores.mul(0.16)).add(0.32)
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.23
    this.anisotropy = 0.42
    this.normalNode = proceduralNormal(latewood.mul(-0.0009).add(fine.mul(0.00008)).sub(pores.mul(0.00035)), 1)
    const season = growth.mul(0.11).sub(time.mul(0.38)).add(view.z.mul(3)).sin().smoothstep(0.87, 1)
    this.emissiveNode = color(hsl.integer(73, 80, 73)).mul(season).mul(latewood.oneMinus()).mul(chatoyance.pow(3)).mul(grazing.mul(0.5).add(0.5)).mul(0.22)
  }
}
