import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.6
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const drift = vec3(time.mul(0.02), time.mul(-0.015), time.mul(0.025))
    const field = mx_noise_float(p.mul(4).add(drift)).mul(0.6).add(mx_noise_float(p.mul(13).sub(drift.mul(2))).mul(0.4))
    const curtain = opticalLine(field.mul(22).add(p.y.mul(4)).sin(), 0.035)
    const sheet = opticalLine(mx_noise_float(p.mul(7).add(vec3(0, time.mul(0.1), 0))).mul(14).sin(), 0.05)
    const auroraMask = curtain.max(sheet.mul(0.7))
    const hue = field.mul(0.9).add(view.x.mul(0.4)).add(view.y.mul(0.3)).add(time.mul(0.03))
    const auroraTint = cosinePalette(hue, [0.35, 0.5, 0.45], [0.35, 0.35, 0.3], [1, 1, 1], [0.1, 0.35, 0.65])
    const horizon = facing.pow(1.5).mul(0.7).add(grazing.pow(3).mul(0.9))
    this.colorNode = mix(color(hsl.integer(238, 44, 4)), auroraTint.mul(0.35), auroraMask.mul(0.4))
    this.metalness = 0.85
    this.roughnessNode = auroraMask.mul(0.2).add(0.28)
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.08
    this.normalNode = liquidNormal(near, 0.18)
    this.emissiveNode = auroraTint.mul(auroraMask).mul(horizon).mul(near.mul(0.8).add(0.35)).add(color(hsl.integer(166, 100, 89)).mul(rim).mul(grazing).mul(0.35)).add(color(hsl.integer(287, 100, 61.4)).mul(sheet).mul(intimate).mul(0.5))
  }
}
