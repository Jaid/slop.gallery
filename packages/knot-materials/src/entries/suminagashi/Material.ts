import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Suminagashi: ink floated on still water, combed into rings, then lifted onto paper in a single breath. Two figures are superimposed — a dense black strike and a wider indigo wash — so the marbling shifts against itself as you walk past, and a scattering of gold leaf has settled into the troughs of the pattern. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
// A slow warp turns concentric drops into the wandering rings a real bath produces.
    const drift = mx_fractal_noise_float(p.mul(1.7), 4, 2.1, 0.55)
    const comb = mx_fractal_noise_float(p.mul(4.6).add(vec3(3.1, 7.7, 1.3)), 3, 2.2, 0.5)
    const radius = p.length().mul(52).add(drift.mul(3.1)).add(comb.mul(1.1))
    const ripple = mx_noise_float(p.mul(23))
    const ink = radius.add(ripple.mul(0.7)).sin().mul(0.5).add(0.5)
// A second, wider figure set, offset so the two never line up.
    const radius2 = p.length().mul(29).sub(2.6).add(drift.mul(1.5))
    const ink2 = radius2.add(ripple.mul(0.4)).sin().mul(0.5).add(0.5)
    const bands = ink.smoothstep(0.3, 0.52).mul(0.95).add(ink2.smoothstep(0.5, 0.7).mul(0.7)).clamp(0, 1)
// Hair-fine fibres of ink that only resolve when you are close.
    const fibre = mx_noise_float(p.mul(96)).abs().sub(0.05)
    const fibreLine = fibre.smoothstep(0, radius.fwidth().mul(1.6).add(0.02)).oneMinus().mul(near).mul(bands)
// ------------------------------------------------------------------
// Paper, two inks, and a scattering of gold leaf.
// ------------------------------------------------------------------
    const paper = mix(color(hsl.integer(89, 27, 37)), color(hsl.integer(85, 22, 60)), mx_fractal_noise_float(p.mul(9), 3, 2, 0.5).mul(0.5).add(0.5))
    const indigo = mix(color(hsl.integer(271, 63, 7)), color(hsl.integer(270, 68, 20.4)), comb.mul(0.5).add(0.5))
    const soot = color(hsl.integer(286, 7, 6))
    const wash = mix(indigo, soot, ink2.pow(2))
    const flakeSeed = cellNoiseVec3(p.mul(64).floor())
    const flakeDist = p.mul(64).fract().sub(flakeSeed.mul(0.6).add(0.2)).length()
    const flake = flakeDist.smoothstep(0.1, 0.26).oneMinus().mul(flakeSeed.z.smoothstep(0.6, 0.72)).mul(bands.smoothstep(0.15, 0.6)).mul(near.mul(0.4).add(0.6))
    const inkColor = mix(wash, color(hsl.integer(92, 100, 92.7)), flake)
    this.colorNode = mix(paper, inkColor, bands.mul(0.96))
    this.metalnessNode = flake.mul(0.95)
    this.roughnessNode = mix(float(0.62), float(0.2), flake).add(bands.mul(-0.1)).add(fibreLine.mul(0.1))
    this.sheen = 0.55
    this.sheenRoughness = 0.35
    this.sheenColor.set(hsl.integer(268, 100, 86))
    this.clearcoat = 0.18
    this.clearcoatRoughness = 0.35
    this.normalNode = proceduralNormal(fibreLine.mul(0.5).add(bands.mul(0.12)).add(flake.mul(0.35)), 0.0013)
// Wet ink catches a last rim of light, and the leaf glints along the figure.
    this.emissiveNode = color(hsl.integer(267, 50, 68)).mul(fibreLine).mul(grazing.pow(2.5)).mul(0.25)
      .add(color(hsl.integer(87, 100, 92.3)).mul(flake).mul(facing.pow(4)).mul(0.5))
      .add(color(hsl.integer(268, 49, 80)).mul(bands).mul(grazing.pow(4)).mul(intimate.mul(0.4).add(0.1)).mul(0.2))
  }
}
