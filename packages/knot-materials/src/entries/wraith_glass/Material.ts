import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const drift = vec3(time.mul(0.02), time.mul(0.035), time.mul(-0.015))
    const wisp = mx_noise_float(inner.mul(4).add(drift))
    const wisps = opticalLine(wisp, 0.05)
    const deepWisp = opticalLine(mx_noise_float(deep.mul(6).sub(drift)), 0.045)
    const breath = time.mul(0.5).sin().mul(0.15).add(0.85)
    this.color.set(hsl.integer(239, 33, 92))
    this.transmission = 0.92
    this.thickness = 0.3
    this.ior = 1.2
    this.dispersion = 0.12
    this.attenuationColor.set(hsl.integer(244, 100, 90))
    this.attenuationDistance = 1.2
    this.roughness = 0.03
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.02
    this.normalNode = liquidNormal(near, 0.08)
    // Almost invisible head-on; wisps and rim only bloom at grazing angles.
    this.emissiveNode = color(hsl.integer(234, 100, 94.5)).mul(wisps).mul(grazing.mul(0.8).add(0.15)).mul(breath).add(color(hsl.integer(261, 99, 80)).mul(deepWisp).mul(near).mul(0.3)).add(color(hsl.integer(0, 0, 100)).mul(rim.pow(3)).mul(0.5))
  }
}
