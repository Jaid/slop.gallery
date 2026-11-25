import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Captured Lightning. A block of clear resin was struck by a sudden discharge, and the charge froze inside it as a Lichtenberg figure: a trunk that splits into branches, and branches that split again, all of it a fraction of a millimetre wide. The resin is otherwise empty, so the figure only appears where the light catches it. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
// The discharge lives inside the resin, so it is sampled a little behind the surface.
    const warp = mx_noise_vec3(p.mul(2)).mul(0.7)
    const inner = p.sub(view.mul(0.07))
// Three generations of channel. Each generation is gated by the one above it,
// so the fine tendrils only exist where a coarser branch already ran – which
// is what makes a discharge look like a tree instead of a contour map.
    const coarseField = mx_fractal_noise_float(inner.mul(2.6).add(warp), 4, 2.1, 0.55)
    const coarse = filament(coarseField, 0.04)
    const mediumField = mx_fractal_noise_float(inner.mul(6.5).add(warp.mul(1.4)).add(3.7), 4, 2.1, 0.55)
    const medium = filament(mediumField, 0.024)
    const fineField = mx_fractal_noise_float(inner.mul(15).add(9.1), 3, 2.1, 0.55)
    const fine = filament(fineField, 0.014)
    const gateCoarse = coarse.smoothstep(0.04, 0.35)
    const gateMedium = medium.smoothstep(0.04, 0.35)
    const discharge = coarse.max(medium.mul(gateCoarse)).max(fine.mul(gateCoarse).mul(gateMedium))
    const core = coarse.mul(0.7).add(medium.mul(gateCoarse).mul(0.4)).clamp()
// A soft glow that fades with distance from each channel instead of outlining it.
    const glow = coarseField.abs().mul(4).oneMinus().max(0).pow(2.5).add(mediumField.abs().mul(6).oneMinus().max(0).pow(2.5).mul(gateCoarse).mul(0.6))
    const haze = mx_noise_float(p.mul(2.6)).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(248, 32, 4)), color(hsl.integer(255, 100, 95)), discharge)
    this.metalness = 0
    this.roughnessNode = float(0.03).add(discharge.mul(0.05))
    this.transmission = 0.6
    this.thickness = 0.45
    this.ior = 1.49
    this.attenuationColor.set(hsl.integer(249, 64, 71))
    this.attenuationDistance = 1.6
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(discharge.mul(0.3), 0.0005)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = color(hsl.integer(0, 0, 100)).mul(core).mul(near.mul(0.3).add(0.7)).mul(22)
      .add(color(hsl.integer(257, 100, 65.5)).mul(discharge).mul(near.mul(0.3).add(0.7)).mul(14))
      .add(color(hsl.integer(260, 78, 41)).mul(glow).mul(near.mul(0.3).add(0.7)).mul(0.5))
      .add(color(hsl.integer(253, 62, 45.5)).mul(haze).mul(0.05))
      .add(color(hsl.integer(257, 100, 85.4)).mul(grazing.pow(3)).mul(0.1))
  }
}
