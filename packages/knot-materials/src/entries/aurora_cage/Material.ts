import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 5. AURORA CAGE A magnetic bottle caught mid-storm. Helical field lines incised into the surface, charged particles streaking along them, and vertical auroral curtains that shimmer green at the equator and burn violet near the poles. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Helical magnetic field lines.
    const fieldAngle = tube.x.mul(Math.PI * 2 * 14)
      .add(tube.y.mul(Math.PI * 2 * 3.5))
    const fieldWobble = mx_noise_float(p.mul(2.2).add(time.mul(0.12))).mul(1.2)
    const fieldLines = opticalLine(fieldAngle.add(fieldWobble).sin(), 0.055)
    const fieldLinesFine = opticalLine(fieldAngle.mul(2.7).add(fieldWobble.mul(0.6)).sin(), 0.04)
      .mul(intimate)
    // Charged particles — bright beads racing along field lines.
    const beadPhase = fieldAngle.sub(time.mul(3.4))
    const beadRaw = beadPhase.sin()
    const bead = beadRaw.abs().pow(32)
    const beadFlash = beadRaw.mul(0.5).add(0.5)
    // Aurora curtains — vertical sheets flickering overhead.
    const curtainPhase = tube.x.mul(Math.PI * 2 * 6)
      .add(mx_noise_float(p.mul(1.4).add(time.mul(0.09))).mul(2.6))
    const curtain = filament(curtainPhase.sin(), 0.22)
    const curtainFine = filament(curtainPhase.mul(3.4).sin(), 0.11).mul(intimate)
    // Falloff away from the "horizon" of the cage.
    const curtainFade = tube.y.sub(0.5).abs().mul(-3.2).exp()
    // Colour ladder: green low, cyan mid, violet high.
    const height = tube.y
    const auroraGreen = color(hsl.integer(152.6, 100, 85.6))
    const auroraCyan = color(hsl.integer(185, 100, 89))
    const auroraViolet = color(hsl.integer(311, 100, 59.6))
    const auroraLow = mix(auroraGreen, auroraCyan, height.mul(2).clamp())
    const auroraHigh = mix(auroraCyan, auroraViolet, height.sub(0.5).mul(2).clamp())
    const auroraCol = mix(auroraLow, auroraHigh, height)
    // Dark ferrous cage.
    const cageDeep = color(hsl.integer(261, 44, 4))
    const cageMid = mix(cageDeep, color(hsl.integer(266, 66, 10)), facing.mul(0.5).add(0.2))
    const auroraStrength = curtain.mul(curtainFade)
      .mul(facing.oneMinus().mul(0.4).add(0.6))
    this.colorNode = cageMid
    this.metalness = 0.35
    this.roughnessNode = float(0.18).sub(fieldLines.mul(0.06))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(fieldLines.mul(0.2).add(mx_noise_float(p.mul(20)).mul(0.06)), 0.0018)
    this.emissiveNode
      = auroraCol.mul(auroraStrength).mul(2.1)
        .add(auroraCol.mul(curtainFine).mul(curtainFade).mul(1.1))
        .add(color(hsl.integer(183, 100, 91.3)).mul(fieldLines).mul(near.mul(0.5).add(0.25)))
        .add(color(hsl.integer(183, 100, 91.3)).mul(fieldLinesFine).mul(0.5))
        .add(color(hsl.integer(0, 0, 100)).mul(bead).mul(beadFlash)
          .mul(intimate.mul(0.8).add(0.4)).mul(3.2))
        .add(color(hsl.integer(170, 100, 88)).mul(rim).mul(0.35))
        .add(color(hsl.integer(253, 71, 15)).mul(grazing).mul(0.2))
  }
}
