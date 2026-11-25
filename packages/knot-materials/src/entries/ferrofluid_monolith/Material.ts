import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, time, uv} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 6. FERROFLUID MONOLITH: Hexagonal Rosensweig Spikes & Hydrocarbon Thin-Film */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {rim, intimate} = viewerFrame()
    const tube = uv()
    // Hexagonal standing-wave lattice for Rosensweig spike cones
    const u1 = tube.x.mul(48)
    const u2 = tube.x.mul(24).add(tube.y.mul(41.569))
    const u3 = tube.x.mul(-24).add(tube.y.mul(41.569))
    const hexSum = u1.cos().add(u2.cos()).add(u3.cos()).div(3)
    const magneticPulse = time.mul(1.2).sin().mul(0.15).add(0.85)
    const spike = hexSum.max(0).pow(3.6).mul(magneticPulse)
    // Viscous liquid normal perturbation
    const spikeNormal = proceduralNormal(spike.mul(0.55), 0.012)
    this.colorNode = color(hsl.integer(243, 18, 3))
    this.metalness = 0.2
    this.roughness = 0.025
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.normalNode = spikeNormal
    // Thin hydrocarbon oil film iridescence focused at spike crests
    this.iridescence = 1
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = spike.mul(440).add(220)
    // Magnetic excitation pulse along the spike ridges
    const ridgePulse = spike.smoothstep(0.4, 0.9)
    this.emissiveNode = mix(color(hsl.integer(310, 100, 53)), color(hsl.integer(168.3, 100, 87)), spike)
      .mul(ridgePulse).mul(1.8).mul(intimate.mul(0.6).add(0.5))
      .add(color(hsl.integer(231, 100, 10)).mul(rim).mul(0.4))
  }
}
