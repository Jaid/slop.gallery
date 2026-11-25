import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 6. CLOCKWORK ORACLE An astrolabe turned inside-out. Gear teeth gnash along the tube, engraved rings march around the cross-section, patina pools in the crevices, and a spectral clock-hand sweeps the surface — brightest when you come close, as if time itself were dilated by your presence. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Gear teeth around the long axis.
    const teethPhase = tube.x.mul(Math.PI * 2 * 56)
    const teethRaw = teethPhase.fract().sub(0.5).abs().mul(2).pow(0.55)
    const teethMask = teethRaw.smoothstep(0.42, 0.72)
    const teethShadow = teethRaw.smoothstep(0.2, 0.5)
    // Concentric engraved rings on the cross-section.
    const ringIdx = tube.y.mul(7)
    const ringPhase = ringIdx.fract()
    const ringEdge = filament(ringPhase.sub(0.5), 0.06)
    const ringFine = filament(tube.y.mul(Math.PI * 2 * 22).fract().sub(0.5), 0.04)
      .mul(intimate)
    // Roman-numeral tick marks around the circuit.
    const tickPhase = tube.x.mul(Math.PI * 2 * 12)
    const tick = filament(tickPhase.fract().sub(0.5).mul(2), 0.07)
    const tickFine = filament(tube.x.mul(Math.PI * 2 * 60).fract().sub(0.5), 0.05)
      .mul(intimate)
    // Sweeping clock-hand — faster as you approach.
    const handSpeed = intimate.mul(1.4).add(0.35)
    const handAngle = time.mul(handSpeed)
    const handCoord = tube.x.mul(Math.PI * 2)
    const handDelta = handCoord.sub(handAngle).sin().abs()
    const handTrace = handDelta.smoothstep(0.012, 0.08).oneMinus()
    // Brass, patina, and wear layers.
    const brassBase = color(hsl.integer(78, 68, 41))
    const brassBright = color(hsl.integer(90, 70, 83))
    const brassHighlight = color(hsl.integer(95, 100, 95.5))
    const patina = color(hsl.integer(165, 35, 34))
    const ironDark = color(hsl.integer(72, 15, 14))
    const wear = mx_noise_float(p.mul(14)).mul(0.5).add(0.5)
    const patinaField = mx_fractal_noise_float(p.mul(6), 3, 2, 0.55).mul(0.5).add(0.5)
    const brass = mix(brassBase, brassBright, wear.mul(0.55).add(facing.mul(0.35)))
    const withPatina = mix(brass, patina, patinaField.mul(ringEdge.mul(0.5).add(0.25)).mul(0.7))
    const withTeeth = mix(withPatina, ironDark, teethShadow.mul(0.35))
    const withTick = mix(withTeeth, brassHighlight, tick.mul(0.4).add(ringEdge.mul(0.25)))
    // Temporal dilation pulse — driven by proximity.
    const dilation = intimate.mul(0.7).add(0.3)
    this.colorNode = withTick
    this.metalnessNode = float(0.86)
      .sub(patinaField.mul(0.35))
      .sub(teethShadow.mul(0.15))
    this.roughnessNode = float(0.28)
      .add(patinaField.mul(0.35))
      .add(teethShadow.mul(0.12))
      .add(ringEdge.mul(0.06))
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.09
    this.normalNode = proceduralNormal(teethMask.mul(0.55)
      .add(ringEdge.mul(0.35))
      .add(tick.mul(0.25))
      .add(tickFine.mul(0.15))
      .add(ringFine.mul(0.15)), 0.0028)
    this.emissiveNode
      = color(hsl.integer(87, 100, 84.5)).mul(handTrace).mul(dilation).mul(1.9)
        .add(color(hsl.integer(226, 100, 83)).mul(rim).mul(dilation.mul(0.5)))
        .add(color(hsl.integer(74, 100, 77.9)).mul(tick).mul(near.mul(0.5).add(0.12)).mul(0.55))
        .add(color(hsl.integer(84, 100, 86)).mul(tickFine).mul(intimate).mul(0.4))
        .add(color(hsl.integer(77, 60, 20)).mul(teethShadow).mul(0.4))
  }
}
