import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_worley_noise_float, normalLocal, positionGeometry, time} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, rim, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const align = n.dot(view).max(0).pow(2.15)
    const cells = mx_worley_noise_float(p.mul(15.5))
    const peak = cells.oneMinus().pow(7.5)
    const breath = time.mul(2.05).sin().mul(0.08).add(0.94)
    const height = peak
      .mul(align)
      .mul(near.mul(0.55).add(0.45))
      .mul(breath)
      .mul(intimate.mul(0.35).add(0.72))
      .mul(0.095)
    this.positionNode = positionGeometry.add(n.mul(height))
    const surfaceNormal = proceduralNormal(height, 0.85)
    this.normalNode = surfaceNormal
    this.clearcoatNormalNode = surfaceNormal
    const tip = height.smoothstep(0.018, 0.072)
    const valley = height.oneMinus()
    const meniscus = opticalLine(cells.sub(0.18), 0.03).mul(align)
    const oil = mix(color(hsl.integer(286, 7, 4)), color(hsl.integer(300, 15, 10)), valley.mul(grazing).mul(0.35))
    const silver = mix(color(hsl.integer(254, 15, 68)), color(hsl.integer(252, 37, 94)), tip.pow(2))
    this.colorNode = mix(oil, silver, tip.mul(0.85).add(meniscus.mul(0.4)))
    this.metalnessNode = tip.mul(0.28).add(0.72)
    this.roughnessNode = valley.mul(0.32).add(0.028)
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.2
    this.envMapIntensity = 1.15
    this.emissiveNode = silver
      .mul(glints(surfaceNormal, 110))
      .mul(tip)
      .mul(1.55)
      .mul(near.mul(0.5).add(0.5))
      .add(color(hsl.integer(258, 22, 22)).mul(meniscus).mul(0.25))
      .add(color(hsl.integer(271, 11, 6)).mul(rim).mul(0.2))
  }
}
