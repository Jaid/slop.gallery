import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

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
    const patch = fbm(p.mul(2.9)).mul(0.5).add(0.5)
    const patchMask = patch.smoothstep(0.52, 0.8)
    const frostLines = opticalLine(fbm(p.mul(8.5)).sub(0.05), 0.05).mul(patchMask)
    const frostFine = opticalLine(fbm(p.mul(21), 2).sub(0.05), 0.038).mul(patchMask).mul(near)
    const frost = frostLines.add(frostFine).clamp()
    const core = p.sub(view.mul(0.3))
    const coreField = fbm(core.mul(3.4).add(vec3(0, time.mul(0.04), 0))).add(core.y.mul(0.8))
    const heartGlow = coreField.smoothstep(0.42, 1.05)
    const aurora = mix(color(hsl.integer(181, 91.6, 81)), color(hsl.integer(287, 100, 61)), coreField.mul(0.5).add(0.5).clamp().pow(1.6))
    const glitter = starGlints(p.mul(85), view, 28)
    this.colorNode = mix(color(hsl.integer(235, 57, 90)), color(hsl.integer(229, 100, 98.5)), fbm(p.mul(6), 2).mul(0.5).add(0.5))
    this.transmission = 0.96
    this.thickness = 0.9
    this.ior = 1.31
    this.dispersion = 0.34
    this.attenuationColor.set(hsl.integer(233, 100, 86))
    this.attenuationDistance = 1.6
    this.roughnessNode = frost.mul(0.52).add(0.045)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.iridescence = 0.25
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = frost.mul(260).add(320)
    this.normalNode = proceduralNormal(frost.mul(0.7).add(mx_noise_float(p.mul(52)).mul(frost).mul(0.18)), 0.0011)
    this.emissiveNode = aurora.mul(heartGlow).mul(near.mul(0.5).add(0.3)).mul(0.85)
      .add(color(hsl.integer(224, 100, 97.4)).mul(frost).mul(rim).mul(0.55))
      .add(color(hsl.integer(229, 100, 93.7)).mul(glitter).mul(near).mul(2))
      .add(color(hsl.integer(230, 100, 90)).mul(rim).mul(0.1))
  }
}
