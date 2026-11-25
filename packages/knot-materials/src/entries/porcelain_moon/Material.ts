import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Moon-white porcelain repaired in gold. Broad fractures carry raised metallic seams that flash as you circle, hairline cracks and a cobalt wash only appear when you come close enough to read the damage. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, near, intimate} = viewerFrame()
    const fracture = cellularBoundary(p.mul(5.5))
    // Raised gold, computed without derivatives for the vertex stage.
    const raised = float(1).sub(fracture.div(0.085).clamp())
    this.positionNode = p.add(normalLocal.normalize().mul(raised.pow(2).mul(0.004)))
    const vein = filteredRibbon(fracture, 0.062)
    const hairCrack = hairline(cellularBoundary(p.mul(12).add(3.7)), 0.012).mul(intimate)
    const washNoise = mx_noise_float(p.mul(3.1)).mul(0.5).add(0.5)
    const cobalt = washNoise.smoothstep(0.54, 0.74).mul(0.85)
    const porcelainTone = mx_noise_float(p.mul(26)).mul(0.035).add(0.96)
    const porcelain = color(hsl.integer(83, 37, 92.6)).mul(porcelainTone)
    const repaired = mix(porcelain, color(hsl.integer(259, 63, 34)), cobalt)
    this.colorNode = mix(mix(repaired, color(hsl.integer(81, 94, 74)), vein), color(hsl.integer(73, 15, 29)), hairCrack.mul(0.55))
    this.metalnessNode = vein.mul(0.96)
    this.roughnessNode = float(0.38).sub(vein.mul(0.22)).add(hairCrack.mul(0.1)).add(cobalt.mul(-0.06)).clamp(0.13, 0.48)
    this.clearcoat = 0.55
    this.clearcoatRoughness = 0.24
    this.sheen = 0.15
    this.sheenColor.set(hsl.integer(83, 100, 96.6))
    const seamNormal = proceduralNormal(raised.mul(0.5).sub(hairCrack.mul(0.12)), 0.65)
    this.normalNode = seamNormal
    this.emissiveNode = color(hsl.integer(85, 100, 88.5)).mul(glints(seamNormal, 120)).mul(vein).mul(near.mul(0.4).add(0.1))
  }
}
