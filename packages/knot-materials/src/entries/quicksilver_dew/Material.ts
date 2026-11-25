import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Living mercury. A slow liquid normal field keeps the mirror in perpetual motion, so the studio slides and stretches across the knot as time passes and as the visitor moves. Heavy droplets bead on the surface, swell in the vertex stage, and catch hard glints only when leaned over; from afar the tide calms into a flawless chrome ribbon. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const {p, grazing, near} = viewerFrame()
    const droplets = beads(p.mul(5), 4.7)
    const flow = mx_noise_float(p.mul(7).add(vec3(0, 0, time.mul(0.05)))).mul(0.5).add(0.5)
    const detail = mix(float(0.12), float(1), near)
    const liquid = liquidNormal(detail, 0.95)
    this.positionNode = positionGeometry.add(normalLocal.mul(droplets.core.mul(0.01)))
    this.normalNode = liquid
    this.clearcoatNormalNode = liquid
    this.colorNode = mix(color(hsl.integer(239, 16, 84)), color(hsl.integer(229, 27, 94)), flow).mul(droplets.mask.mul(-0.12).add(1))
    this.metalness = 1
    this.roughnessNode = mix(mix(float(0.05), float(0.17), flow), float(0.02), droplets.mask)
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.08
    const sparkle = glints(normalViewGeometry, 180).mul(droplets.core).mul(near)
    this.emissiveNode = color(hsl.integer(0, 0, 100)).mul(sparkle.mul(0.5)).add(spectralColor(flow.mul(5).add(1.2)).mul(grazing.pow(3)).mul(0.05))
  }
}
