import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const noise = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const warp = mx_noise_vec3(inner.mul(6)).mul(0.7)
    const fault = mx_noise_float(inner.mul(10).add(warp))
    const bolts = opticalLine(fault, 0.017)
    const branches = opticalLine(mx_noise_float(deep.mul(23)), 0.022).mul(fault.abs().smoothstep(0.03, 0.23).oneMinus()).mul(near)
    // Slow traveling charge, deliberately not a strobe.
    const charge = inner.y.mul(7).sub(time.mul(0.8)).sin().mul(0.18).add(0.82)
    this.colorNode = mix(color(hsl.integer(265, 92, 13.5)), color(hsl.integer(262, 88, 32)), noise)
    this.transmission = 0.58
    this.thickness = 0.38
    this.ior = 1.7
    this.dispersion = 0.42
    this.attenuationColor.set(hsl.integer(266, 93, 29.6))
    this.attenuationDistance = 0.55
    this.roughness = 0.08
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.045
    this.emissiveNode = mix(color(hsl.integer(260, 100, 56)), color(hsl.integer(238, 100, 95)), facing).mul(bolts.mul(1.45).add(branches.mul(0.7))).mul(charge).add(color(hsl.integer(267.6, 96, 46)).mul(rim).mul(0.2))
  }
}
