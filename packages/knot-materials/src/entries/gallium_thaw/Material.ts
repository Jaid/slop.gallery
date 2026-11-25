import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_cell_noise_float, normalViewGeometry, time, uv, vec3} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const melt = near.mul(0.62).add(intimate.mul(0.38)).clamp()
    const drips = opticalLine(p.x.mul(13).add(p.z.mul(9.5)).add(p.y.mul(-5.5)).add(time.mul(0.28)).sin(), 0.038).mul(melt)
    const beads = mx_cell_noise_float(vec3(p.x.mul(9.5), p.y.mul(3.6).sub(time.mul(0.45)), p.z.mul(9.5)))
      .smoothstep(0.9, 0.975)
      .mul(melt)
    const wetting = opticalLine(uv().y.sub(0.5), 0.07).mul(melt).mul(intimate)
    const solid = mix(color(hsl.integer(248, 5, 48)), color(hsl.integer(248, 6, 65)), grazing.mul(0.45).add(0.2))
    const liquid = mix(color(hsl.integer(251, 16, 82)), color(hsl.integer(242, 28, 95.5)), facing)
    this.colorNode = mix(solid, mix(liquid, color(hsl.integer(248, 29, 97)), beads.max(drips)), melt)
    this.metalnessNode = melt.mul(0.22).add(0.76)
    this.roughnessNode = melt.oneMinus().mul(0.48).add(0.018).add(beads.mul(-0.01))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = melt.oneMinus().mul(0.28).add(0.02)
    this.envMapIntensity = 1.25
    this.normalNode = liquidNormal(melt.mul(1.4).add(0.15), melt.mul(0.38).add(0.04))
    this.iridescenceNode = melt.mul(0.18)
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = melt.mul(90).add(120)
    this.emissiveNode = liquid
      .mul(glints(normalViewGeometry, 95))
      .mul(melt)
      .mul(0.55)
      .add(color(hsl.integer(244, 24, 91)).mul(beads).mul(glints(normalViewGeometry, 140)).mul(1.4))
      .add(color(hsl.integer(245, 14, 78)).mul(drips.add(wetting)).mul(0.28))
      .add(color(hsl.integer(248, 12, 20)).mul(rim).mul(melt.oneMinus().mul(0.2)))
    this.side = DoubleSide
  }
}
