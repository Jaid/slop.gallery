import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_fractal_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const p = positionGeometry
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(4)
    // Soap film: thickness drifts slowly and drains downward, driving thin-film interference.
    const flow = mx_fractal_noise_float(p.mul(2.2).add(vec3(0, time.mul(0.03), time.mul(-0.02))), 3, 2, 0.5)
    const thin = flow.mul(0.5).add(0.5)
    const drain = p.y.mul(-0.4).add(0.5).clamp()
    this.colorNode = color(hsl.integer(264, 25, 4.5))
    this.transmission = 0.95
    this.thickness = 0.06
    this.ior = 1.33
    this.roughness = 0.015
    this.metalness = 0
    this.iridescence = 1
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = thin.mul(520).add(drain.mul(300)).add(130)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = liquidNormal(near, 0.05)
    this.emissiveNode = spectralColor(thin.mul(3).add(time.mul(0.04))).mul(grazing.pow(2)).mul(0.5).add(color(hsl.integer(0, 0, 100)).mul(rim).mul(0.6))
  }
}
