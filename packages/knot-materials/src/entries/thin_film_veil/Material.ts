import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_fractal_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    // Soap drains downward: the film thins at the top, pools thick below.
    const drift = vec3(time.mul(0.012), time.mul(-0.05), time.mul(0.018))
    const flow = mx_fractal_noise_float(p.mul(2.4).add(drift), 4, 2, 0.5).mul(0.5).add(0.5)
    const drain = p.y.mul(-0.5).add(0.5).clamp()
    const filmThickness = flow.mul(360).add(drain.mul(430)).add(130)
    this.colorNode = color(hsl.integer(262, 100, 97.4))
    this.transmission = 1
    this.thickness = 0.06
    this.ior = 1.06
    this.dispersion = 0.2
    this.attenuationColor.set(hsl.integer(275, 100, 93))
    this.attenuationDistance = 3
    this.roughness = 0.015
    this.metalness = 0
    this.iridescence = 1
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = filmThickness
    this.clearcoat = 1
    this.clearcoatRoughness = 0.01
    this.normalNode = liquidNormal(near, 0.06)
    this.emissiveNode = color(hsl.integer(0, 0, 100)).mul(grazing.pow(4)).mul(0.45).add(color(hsl.integer(296, 99, 71)).mul(flow.smoothstep(0.7, 0.95)).mul(near).mul(0.14))
  }
}
