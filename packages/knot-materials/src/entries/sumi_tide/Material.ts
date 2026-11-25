import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A rice-paper surface wrapped around the knot. Black ink blooms and retreats through the fibers in slow waves. Capillary tendrils dissolve into wet paper fibers up close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    // Paper fiber texture
    const fiberCoarse = mx_noise_float(p.mul(12)).mul(0.5).add(0.5)
    // Ink bloom — single layer with domain warp for organic look
    const drift = vec3(time.mul(0.04), time.mul(-0.025), time.mul(0.018))
    const inkField = mx_noise_float(p.mul(5).add(drift.mul(0.5)))
    const inkMedium = mx_noise_float(p.mul(11).sub(drift))
    const inkCombined = inkField.mul(0.65).add(inkMedium.mul(0.35))
    const inkThreshold = inkCombined.smoothstep(-0.15, 0.35)
    // View-dependent wash — grazing angles reveal more ink
    const viewWash = grazing.pow(2.5).mul(0.25)
    const inkDensity = inkThreshold.add(viewWash).clamp()
    // Paper color
    const paper = mix(color(hsl.integer(92, 56, 93.7)), color(hsl.integer(89, 36, 89)), fiberCoarse)
    // Ink color — warm charcoal with slight variation
    const ink = mix(color(hsl.integer(67, 14, 10)), color(hsl.integer(272, 20, 8)), inkCombined.mul(0.5).add(0.5).clamp())
    this.colorNode = mix(paper, ink, inkDensity)
    // Paper matte; ink slightly glossier when "wet"
    const wetness = inkDensity.mul(near.mul(0.4).add(0.3))
    this.roughnessNode = float(0.82).sub(wetness.mul(0.4)).clamp(0.3, 0.88)
    this.metalness = 0
    // Sized paper surface
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.3
    this.sheen = 0.35
    this.sheenColor.set(hsl.integer(85, 44, 87))
    this.sheenRoughness = 0.65
    // Normal — paper fiber plus ink pooling
    this.normalNode = proceduralNormal(
      fiberCoarse.mul(0.5).add(inkDensity.mul(0.2)),
      0.0008,
    )
    // Ink absorption buckles the paper
    const buckling = inkDensity.mul(near.mul(0.6).add(0.2)).mul(-0.003)
    this.positionNode = positionGeometry.add(normalLocal.mul(buckling))
    // Faint warm glow at ink edges
    const inkEdge = inkThreshold.fwidth().mul(8).clamp()
    const wetGlint = inkEdge.mul(inkDensity).mul(near).mul(facing.pow(3))
    // Interior backlight glow through the paper
    const innerP = p.sub(view.mul(0.15))
    const innerField = mx_noise_float(innerP.mul(5).add(drift.mul(2))).mul(0.5).add(0.5)
    const innerGlow = innerField.smoothstep(0.55, 0.85).mul(inkDensity.oneMinus()).mul(intimate)
    this.emissiveNode = color(hsl.integer(80, 66, 72)).mul(wetGlint).mul(0.15)
      .add(color(hsl.integer(83, 61, 82)).mul(innerGlow).mul(0.06))
  }
}
