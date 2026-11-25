import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const noise = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    // Camera position transformed into object space.
    //
    // All internal layers below are displaced along the actual camera ray
    // rather than screen UVs, so details remain anchored inside the sculpture
    // while walking around it.
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // Two distance gates.
    //
    // Major structures can be read from across the gallery. Fine structures
    // emerge continuously on approach instead of popping into existence.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    // Four apparent physical depths.
    //
    // Walking sideways causes these layers to separate naturally through
    // parallax. Looking straight on compresses them back together.
    const depth = p.sub(view.mul(0.075))
    const deep = p.sub(view.mul(0.28))
    // Metallic living chitin.
    //
    // Three oblique wave families construct scale boundaries. A second shell
    // exists beneath the first and separates from it through camera parallax.
    const shellA = depth.dot(vec3(20, 3, 14)).sin()
    const shellB = depth.dot(vec3(-13, 18, 7)).sin()
    const shellC = depth.dot(vec3(9, -11, 21)).sin()
    const cell = shellA.mul(shellB).add(shellB.mul(shellC)).add(shellC.mul(shellA))
    const seams = opticalLine(cell, 0.075)
    const underA = deep.dot(vec3(24, -4, 17)).add(time.mul(0.035)).sin()
    const underB = deep.dot(vec3(-16, 21, 9)).sub(time.mul(0.028)).sin()
    const underC = deep.dot(vec3(12, -13, 25)).sin()
    const underCell = underA.mul(underB).add(underB.mul(underC)).add(underC.mul(underA))
    const underSeams = opticalLine(underCell, 0.06).mul(near)
    const phase = cell.mul(3.6).add(view.x.mul(8.5)).add(view.y.mul(4)).sub(view.z.mul(6))
    const shellColor = spectralColor(phase)
    const underColor = spectralColor(phase.add(2.1))
    const eyeFlash = view.dot(vec3(0.67, 0.21, -0.71).normalize()).abs().pow(10)
    this.colorNode = mix(color(hsl.integer(200, 86, 18)), color(hsl.integer(207, 80, 37)), noise).add(shellColor.mul(grazing.mul(0.18).add(0.04)))
    this.metalness = 0.86
    this.roughnessNode = seams.mul(0.17).add(0.085)
    this.iridescenceNode = grazing.mul(0.72).add(0.22).clamp()
    this.iridescenceIOR = 1.46
    this.iridescenceThicknessNode = noise.mul(310).add(140)
    this.clearcoat = 0.94
    this.clearcoatRoughness = 0.034
    this.normalNode = proceduralNormal(cell, 0.0015)
    this.emissiveNode = underColor.mul(underSeams).mul(near.mul(0.85).add(0.2)).add(color(hsl.integer(180, 100, 91.5)).mul(seams).mul(eyeFlash).mul(0.34)).add(shellColor.mul(rim).mul(0.095))
  }
}
