import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Kintsugi porcelain. Ivory glaze with a breath of celadon is broken by rivers of gold that widen as the visitor approaches, sprouting fine tributaries and a hairline crackle that only exists at intimate range. The seams are true metal: they stay dark until the gaze crosses their reflection, then flare in a traveling glint. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const celadon = mx_noise_float(p.mul(2.3)).mul(0.5).add(0.5)
    const porcelain = mix(color(hsl.integer(85, 44, 93.6)), color(hsl.integer(140, 26, 91)), celadon).mul(mx_noise_float(p.mul(31)).mul(0.04).add(0.98))
    const warp = mx_noise_float(p.mul(2.2))
    const field = mx_noise_float(p.mul(4.6).add(vec3(warp).mul(1.4)))
    const river = opticalLine(field, 0.085)
    const vein = opticalLine(field, 0.03)
    const tributary = opticalLine(mx_noise_float(p.mul(12).add(vec3(warp).mul(0.8))), 0.018).mul(intimate)
    const goldField = river.mul(0.75).max(vein).max(tributary).clamp(0, 1)
    const crackle = hairline(cellularBoundary(p.mul(24)), 0.012).mul(near)
    const goldTone = mix(color(hsl.integer(79, 76, 55)), color(hsl.integer(87, 75, 82.5)), mx_noise_float(p.mul(9)).mul(0.5).add(0.5))
    const shaded = porcelain.mul(crackle.mul(-0.1).add(1))
    this.colorNode = mix(shaded, goldTone, goldField)
    this.metalnessNode = goldField.mul(0.95)
    this.roughnessNode = mix(float(0.16), float(0.3), goldField).add(crackle.mul(0.08))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.05
    this.iridescence = 0.12
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = grazing.mul(180).add(240)
    this.normalNode = proceduralNormal(goldField.mul(0.35).add(crackle.mul(0.12)).add(mx_noise_float(p.mul(20)).mul(0.08)), 0.0012)
    this.clearcoatNormalNode = this.normalNode
    const flare = glints(normalViewGeometry, 160).mul(goldField)
    this.emissiveNode = color(hsl.integer(77, 100, 85)).mul(flare).mul(near.mul(0.7).add(0.45)).add(goldTone.mul(goldField).mul(0.07))
  }
}
