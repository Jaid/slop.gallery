import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Black velvet. The nap only colors where the view skims it, and that skim reveals a slow nebula plus a few stars. Face-on, the cloth stays nearly lightless. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.04)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const gas = mx_noise_float(p.mul(1.5).add(view.mul(1.4)).add(time.mul(0.03))).mul(0.5).add(0.5)
    const gas2 = mx_noise_float(p.mul(3.1).add(view.mul(0.6)).add(4)).mul(0.5).add(0.5)
    const nebula = mix(color(hsl.integer(16, 100, 62.6)), color(hsl.integer(263, 100, 55)), gas2)
    const warm = mix(nebula, color(hsl.integer(66, 100, 79)), gas.pow(3))
    const reveal = grazing.pow(1.6).mul(intimate.mul(0.2).add(0.55))
    const stars = starfield(view.mul(0.5).add(p.mul(0.2)).normalize(), 14, 0.94)
    const pile = mx_noise_float(p.mul(10).add(view)).mul(0.5).add(0.5)
    this.colorNode = color(hsl.integer(310, 41, 3))
    this.roughnessNode = float(0.98).sub(grazing.mul(0.7)).clamp(0.18, 1)
    this.sheen = 0.45
    this.sheenColor.set(hsl.integer(316, 100, 90))
    this.sheenRoughnessNode = float(0.8).sub(grazing.mul(0.45)).clamp(0.18, 0.9)
    this.normalNode = proceduralNormal(pile, 0.018)
    this.emissiveNode = warm.mul(reveal).mul(1.8)
      .add(stars.mul(reveal.mul(0.4).add(0.8)).mul(2))
      .add(color(hsl.integer(342, 100, 90.4)).mul(grazing.pow(6)).mul(near).mul(0.25))
      .add(color(hsl.integer(0, 0, 0)).mul(facing.mul(0)))
  }
}
