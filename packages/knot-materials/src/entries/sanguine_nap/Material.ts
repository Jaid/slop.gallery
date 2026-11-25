import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Silk velvet with the pile crushed both ways, dusted with the gold of an old loom. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
// The pile: velvet lies one colour with the nap and another against it, and the lay drifts for ever.
    const lay = mx_fractal_noise_float(p.mul(2.4), 3, 2.1, 0.5)
      .add(mx_fractal_noise_float(p.mul(6.1), 2, 2.2, 0.5).mul(0.35))
      .add(time.mul(0.011).sin().mul(0.04))
    const withNap = lay.smoothstep(-0.55, 0.5)
    const pile = mix(color(hsl.integer(3, 74, 7)), color(hsl.integer(19, 92, 19.6)), withNap)
// Crushed streaks: pile bent flat, so it takes the light and gives it straight back.
    const crushField = mx_noise_float(vec2(tube.x.mul(150), tube.y.mul(11)))
    const crushed = crushField.abs().smoothstep(0.5, 0.1).mul(near.mul(0.35).add(0.65))
// Gold: the dust an old loom leaves behind, caught in the nap.
    const fleck = cellularPoints(p.mul(52).add(4.4), 0.02, 0.075, 0.83).mul(near.mul(0.5).add(0.5))
    const thread = fleck.mul(0.85)
// Velvet keeps its pile upright: the surface itself stays smooth, and all the relief is a normal map.
    this.colorNode = mix(pile, color(hsl.integer(83, 71, 76)), thread)
    this.metalnessNode = thread
    this.roughnessNode = thread.mul(0.24).sub(crushed.mul(0.1)).add(0.86).clamp(0.3, 0.96)
    const fibre = mx_noise_float(p.mul(680)).mul(0.5).add(0.5).mul(intimate.mul(0.3))
    this.normalNode = proceduralNormal(thread.mul(0.35).add(fibre.mul(0.16)), 0.14)
    this.sheenNode = mix(color(hsl.integer(16, 87, 47)), color(hsl.integer(35, 100, 71.6)), withNap)
    this.sheenRoughnessNode = crushed.mul(0.15).add(0.72)
    this.emissiveNode = mix(color(hsl.integer(20, 92.5, 55)), color(hsl.integer(33, 100, 66)), withNap).mul(grazing.pow(2.6)).mul(0.14)
      .add(color(hsl.integer(59, 100, 79)).mul(thread).mul(grazing.pow(2.2)).mul(near.mul(0.3).add(0.2)).mul(0.1))
      .add(color(hsl.integer(65, 100, 87.5)).mul(crushed).mul(grazing.pow(3)).mul(0.05))
  }
}
