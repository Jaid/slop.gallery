import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, time, uv} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 7. PHOTONIC MORPHO: Biomimetic Scale Nanocages & Coherent Bragg Diffraction */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, near, intimate} = viewerFrame()
    const tube = uv()
    // Longitudinal nanoscale cuticle micro-ribs
    const microRibs = tube.x.mul(Math.PI * 480).sin().mul(0.5).add(0.5)
    // Discrete Bragg interference conditions (constructive wavelength reinforcement)
    // Constructive path: 2 * d * cos(theta) = m * lambda
    const braggPeakA = facing.sub(0.65).div(0.16).abs().pow(2).negate().exp()
    // Royal Cobalt Flash
    const braggPeakB = facing.sub(0.42).div(0.14).abs().pow(2).negate().exp()
    // Electric Cyan / UV Flash
    const morphoBlue = color(hsl.integer(264.06, 100, 41.4))
    const morphoCyan = color(hsl.integer(199, 100, 86.5))
    const structuralFlash = morphoBlue.mul(braggPeakA).add(morphoCyan.mul(braggPeakB.mul(0.8)))
    // Sub-dermal emerald bioluminescent breathing micro-pores
    const breath = time.mul(0.7).sin().mul(0.3).add(0.7)
    const pores = cellularPoints(p.mul(50), 0.04, 0.18).mul(breath).mul(intimate)
    this.colorNode = color(hsl.integer(267, 20, 4))
    this.metalnessNode = structuralFlash.length().mul(0.65)
    this.roughnessNode = microRibs.mul(0.08).add(0.24)
    // Velvet chitin micro-sheen
    this.sheen = 0.8
    this.sheenRoughnessNode = float(0.4)
    this.sheenNode = color(hsl.integer(260, 100, 12))
    this.normalNode = proceduralNormal(microRibs.mul(0.06), 0.002)
    this.emissiveNode = structuralFlash.mul(microRibs.mul(0.4).add(0.8)).mul(3.2)
      .add(color(hsl.integer(152.6, 100, 85.6)).mul(pores).mul(3))
      .mul(near.mul(0.5).add(0.5))
  }
}
