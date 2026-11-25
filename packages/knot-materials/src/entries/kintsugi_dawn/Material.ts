import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import {fbm} from '../../candidates/glm/lib/fbm.ts'
import {starGlints} from '../../candidates/glm/lib/starGlints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const grazing = normalViewGeometry.dot(positionViewDirection).abs().clamp().oneMinus()
    const rim = grazing.pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const clay = fbm(p.mul(5.5), 2)
    const crackField = fbm(p.mul(2.6)).sub(0.05)
    const veins = opticalLine(crackField, 0.05)
    const veinsWide = opticalLine(crackField, 0.13)
    const fineVeins = opticalLine(fbm(p.mul(7.2)).sub(0.05), 0.04).mul(near)
    const gold = veins.max(fineVeins)
    const dust = starGlints(p.mul(150), view, 16).mul(veinsWide).mul(near)
    const breath = time.mul(0.07).sin().mul(0.5).add(0.5)
    const clayMix = clay.mul(0.5).add(0.5)
    const speck = mx_noise_float(p.mul(72)).mul(0.5).add(0.5).smoothstep(0.72, 0.95).mul(0.55)
    const clayColor = mix(mix(color(hsl.integer(326, 18, 10)), color(hsl.integer(347, 14, 15)), clayMix), color(hsl.integer(340, 10, 24)), speck)
    this.colorNode = mix(clayColor.add(color(hsl.integer(40, 65, 13)).mul(veinsWide).mul(0.4)), color(hsl.integer(82, 84, 81.6)), gold)
    this.metalnessNode = gold.mul(0.97)
    this.roughnessNode = gold.oneMinus().mul(0.38).add(0.22).add(mx_noise_float(p.mul(60)).mul(0.04))
    this.iridescence = 0.2
    this.iridescenceIOR = 1.3
    this.iridescenceNode = gold.mul(0.25)
    this.clearcoat = 0.06
    this.envMapIntensity = 1.25
    this.normalNode = proceduralNormal(veinsWide.mul(0.8).add(fineVeins.mul(0.5)).add(mx_noise_float(p.mul(34)).mul(0.2)), 0.0019)
    this.emissiveNode = color(hsl.integer(77, 100, 85)).mul(dust).mul(1.5)
      .add(color(hsl.integer(55, 100, 74.8)).mul(veins).mul(rim).mul(breath).mul(near.mul(0.4).add(0.3)).mul(0.85))
  }
}
