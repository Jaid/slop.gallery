import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
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
    const intimate = positionView.length().smoothstep(0.7, 2.4).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    const warp = mx_noise_vec3(inner.mul(5.5)).mul(0.62)
    const fault = mx_noise_float(inner.mul(8.5).add(warp))
    const seams = opticalLine(fault, 0.015)
    const hairline = opticalLine(mx_noise_float(p.mul(19).add(warp.mul(0.4))), 0.01)
    const branches = opticalLine(mx_noise_float(deep.mul(24)), 0.02).mul(fault.abs().smoothstep(0.025, 0.2).oneMinus())
    const charge = inner.dot(vec3(0.4, 1, 0.25)).mul(6.5).sub(time.mul(0.9)).sin().mul(0.16).add(0.84)
    const porcelain = mix(color(hsl.integer(81, 34, 88)), color(hsl.integer(56, 7, 57)), noise.mul(0.55))
    this.colorNode = mix(porcelain, color(hsl.integer(85, 70, 69)), seams.mul(0.85).add(hairline.mul(0.35)))
    this.metalnessNode = seams.mul(0.92)
    this.roughnessNode = seams.oneMinus().mul(0.16).add(0.045)
    this.normalNode = proceduralNormal(fault.abs().mul(-1).add(mx_noise_float(p.mul(30)).mul(0.15)), 0.0028)
    this.clearcoat = 0.82
    this.clearcoatRoughness = 0.05
    this.emissiveNode = mix(color(hsl.integer(76, 100, 78)), color(hsl.integer(96, 100, 96)), facing).mul(seams.mul(1.35).add(hairline.mul(0.45)).add(branches.mul(near).mul(0.65))).mul(charge).add(color(hsl.integer(91, 100, 92)).mul(intimate).mul(seams).mul(0.55)).add(color(hsl.integer(71, 86, 43)).mul(rim).mul(0.08))
  }
}
