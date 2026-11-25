import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, normalViewGeometry, uv, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/muse_wonder/lib/detailNormal.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Porcelain repaired with gold. The seams are the jagged edges of a turbulence-warped fracture network, raised slightly in the relief – dull bronze in shadow, they flare to bright metal when a studio lamp finds them, so the whole history of the break re-lights itself as the viewer circles. A fine dark crackle in the glaze and granular texture inside the gold only resolve up close; from afar the seams settle to calm, continuous lines. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const warp = mx_noise_vec3(p.mul(2).add(vec3(3.1, 7.7, 1.3))).mul(0.3).add(mx_noise_vec3(p.mul(7).add(vec3(9.4, 1.8, 5.6))).mul(0.1))
    const seamField = cellularBoundary(p.mul(3.2).add(warp))
    const seam = hairline(seamField, 0.011)
    const seamSoft = seamField.smoothstep(0.004, 0.07).oneMinus()
    const tube = uv()
    const ringPhase = tube.x.mul(5).add(mx_noise_float(p.mul(16).add(vec3(2.2, 5.5, 8.1))).mul(0.022))
    const ringField = ringPhase.fract().sub(0.5)
    const ring = hairline(ringField, 0.005)
    const breakZone = mx_fractal_noise_float(p.mul(1.35).add(vec3(1.7, 8.2, 3.4)), 3, 2.1, 0.55).mul(0.5).add(0.5).smoothstep(0.44, 0.6)
    const branchMask = hairline(ringField, 0.09).max(breakZone)
    const gold = ring.max(seam.mul(branchMask).mul(near.mul(0.7).add(0.3)))
    const goldWide = hairline(ringField, 0.02).max(seamSoft.mul(branchMask))
    const crackleField = cellularBoundary(p.mul(16).add(warp.mul(1.6)).add(vec3(5.5, 9.2, 2.8)))
    const crackle = hairline(crackleField, 0.008).mul(near).mul(gold.oneMinus())
    const granule = mx_noise_float(p.mul(46)).mul(0.5).add(0.5)
    const tint = mx_noise_float(p.mul(2.1).add(vec3(7.7, 3.3, 1.9))).mul(0.5).add(0.5)
    let porcelain = mix(color(hsl.integer(85, 35, 88)), color(hsl.integer(147, 19, 81)), tint)
    porcelain = mix(porcelain, color(hsl.integer(117, 7, 58)), cellularPoints(p.mul(34), 0.04, 0.16, 0.62).mul(intimate).mul(0.14))
    const goldColor = mix(color(hsl.integer(71, 86, 43)), color(hsl.integer(85, 86, 82)), granule.mul(near.mul(0.5).add(0.5)))
    let surface = mix(porcelain, goldColor, gold)
    surface = surface.mul(crackle.mul(-0.15).add(1))
    this.colorNode = surface
    const relief = goldWide.mul(0.22).sub(crackle.mul(0.05))
    const seamNormal = detailNormal(normalViewGeometry, relief, 0.06)
    this.normalNode = seamNormal
    this.clearcoatNormalNode = normalViewGeometry
    this.metalnessNode = gold.mul(0.96)
    this.roughnessNode = mix(mix(float(0.07), float(0.14), tint), float(0.22), gold).add(crackle.mul(0.1))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.ior = 1.5
    this.aoNode = crackle.mul(-0.16).add(1)
    this.emissiveNode = color(hsl.integer(84, 100, 84.2)).mul(gold).mul(glints(seamNormal, 90)).mul(0.18).add(color(hsl.integer(90, 100, 95.6)).mul(gold).mul(grazing.pow(4)).mul(0.05))
  }
}
