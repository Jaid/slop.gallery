import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, positionGeometry, uv, vec3} from 'three/tsl'

import {premiumDetail} from '../../candidates/gpt_astra/lib/premiumDetail.ts'
import {premiumIntimate} from '../../candidates/gpt_astra/lib/premiumIntimate.ts'
import {premiumLine} from '../../candidates/gpt_astra/lib/premiumLine.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal as premiumNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const st = uv()
    const detail = premiumDetail()
    const intimate = premiumIntimate()
    const u = st.x.mul(TAU)
    const v = st.y.mul(TAU)
    const scrollU = u.mul(14).add(v.mul(2).sin().mul(0.7))
    const scrollV = v.mul(5).add(u.mul(2).sin().mul(0.5))
    const stemField = scrollU.sin().add(scrollV.add(scrollU.cos().mul(1.65)).sin().mul(0.74))
    const stems = premiumLine(stemField, 0.095)
    const leafField = scrollU.sin().mul(scrollV.cos())
    const leaves = leafField.abs().smoothstep(0.69, 0.9).mul(stemField.abs().smoothstep(0.15, 0.65))
    const paintedBorder = premiumLine(v.mul(3).sin().abs().sub(0.88), 0.04)
    const paint = stems.mul(0.75).add(leaves.mul(0.92)).add(paintedBorder.mul(0.9)).clamp()
    const pigment = mx_noise_float(p.mul(48)).mul(0.5).add(0.5)
    const cobalt = mix(color(hsl.integer(265, 88, 12)), color(hsl.integer(258, 76, 40)), pigment.mul(0.65).add(0.15))
    const distorted = p.add(mx_noise_vec3(p.mul(5.5)).mul(0.07))
    const crackA = distorted.dot(vec3(13, 8, -6)).sin().abs()
    const crackB = distorted.dot(vec3(-7, 17, 11)).add(1.4).sin().abs()
    const crackField = crackA.min(crackB)
    const fissure = premiumLine(crackField, 0.047)
    const goldCore = premiumLine(crackField, 0.018)
    const ivory = mix(color(hsl.integer(90, 24, 85)), color(hsl.integer(87, 100, 97.7)), mx_noise_float(p.mul(6)).mul(0.3).add(0.6))
    const painted = mix(ivory, cobalt, paint)
    const repaired = mix(painted, color(hsl.integer(67, 46, 23)), fissure.mul(0.78))
    this.colorNode = mix(repaired, color(hsl.integer(81, 74, 77)), goldCore)
    this.metalnessNode = goldCore.mul(0.94)
    this.roughnessNode = mix(pigment.mul(0.018).add(0.16), float(0.255), goldCore)
    this.ior = 1.49
    this.clearcoat = 1
    this.clearcoatRoughness = 0.055
    const ceramic = mx_noise_float(p.mul(82)).mul(intimate).mul(0.025)
    const relief = goldCore.mul(0.34).sub(fissure.mul(0.75)).add(ceramic)
    this.normalNode = premiumNormal(relief.mul(detail), 0.00065)
    this.clearcoatNormalNode = premiumNormal(mx_noise_float(p.mul(9)), 0.00012)
    this.envMapIntensity = 0.92
  }
}
