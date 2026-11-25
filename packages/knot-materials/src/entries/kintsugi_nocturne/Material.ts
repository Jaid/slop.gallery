import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Three deliberate faults cut through the fired body. Their broad, rounded vertex relief is computed without screen derivatives, while a fine powder variation is confined inside the raised urushi-gold seams. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.32)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const clay = mx_noise_float(p.mul(3.1)).mul(0.5).add(0.5)
    const firing = mx_noise_float(p.mul(20)).mul(0.5).add(0.5)
    const warpA = mx_noise_float(p.mul(6.3).add(vec3(4.1, 1.7, 8.2))).mul(0.5).add(0.5).sub(0.5).mul(0.12)
    const warpB = mx_noise_float(p.mul(7.7).add(vec3(9.2, 2.4, 0.8))).mul(0.5).add(0.5).sub(0.5).mul(0.09)
    const faultFieldA = p.dot(vec3(0.74, 0.29, -0.61).normalize()).add(warpA)
    const faultFieldB = p.dot(vec3(-0.38, 0.87, 0.31).normalize()).sub(0.075).add(warpB)
    const faultFieldC = p.dot(vec3(0.21, -0.46, 0.86).normalize()).add(0.145).add(warpA.mul(0.55))
    const seamA = opticalLine(faultFieldA, 0.012)
    const seamB = opticalLine(faultFieldB, 0.011)
    const seamC = opticalLine(faultFieldC, 0.008).mul(clay.smoothstep(0.62, 0.8))
    const gold = seamA.add(seamB.mul(0.83)).add(seamC.mul(0.42)).clamp()
    const reliefA = faultFieldA.abs().smoothstep(0.011, 0.036).oneMinus()
    const reliefB = faultFieldB.abs().smoothstep(0.01, 0.032).oneMinus()
    const reliefC = faultFieldC.abs().smoothstep(0.008, 0.025).oneMinus().mul(clay.smoothstep(0.62, 0.8))
    const relief = reliefA.add(reliefB.mul(0.82)).add(reliefC.mul(0.45)).clamp()
    const porcelain = mix(color(hsl.integer(254, 100, 1.7)), color(hsl.integer(256, 67, 6.5)), clay.mul(0.22).add(firing.mul(0.05)).clamp())
    const leafGrain = mx_noise_float(p.mul(72)).mul(0.5).add(0.5)
    const leaf = mix(color(hsl.integer(69, 92, 51)), color(hsl.integer(88, 100, 87)), leafGrain.mul(0.66).add(firing.mul(0.13)).clamp())
    this.positionNode = p.add(normalLocal.mul(relief.mul(0.0085)))
    this.colorNode = mix(porcelain, leaf, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.22), float(0.11), gold).add(firing.mul(0.02)).add(grazing.mul(0.018)).clamp(0.07, 0.29)
    this.ior = 1.54
    this.clearcoat = 1
    this.clearcoatNode = gold.oneMinus().mul(0.48)
    this.clearcoatRoughnessNode = mix(float(0.075), float(0.15), gold)
    const glazeNormal = proceduralNormal(relief.mul(0.88).add(leafGrain.mul(gold).mul(0.22)).add(firing.mul(0.035)), 0.0028)
    this.normalNode = glazeNormal
    this.clearcoatNormalNode = glazeNormal
    const leafGlint = glints(glazeNormal, 112).mul(gold).mul(near)
    this.emissiveNode = color(hsl.integer(90, 79, 89)).mul(leafGlint).mul(intimate.mul(0.11).add(0.008))
  }
}
