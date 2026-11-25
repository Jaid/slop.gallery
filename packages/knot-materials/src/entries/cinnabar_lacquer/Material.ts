import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Deep cinnabar lacquer carved in a slow spiral. Where the viewing angle cuts the coats, gold leaf shows through and glints only while you face it. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.08)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const tube = uv()
    const spiral = tube.x.mul(TAU * 1.5).add(tube.y.mul(TAU * 2))
    const ridge = spiral.sin().abs()
    const carved = ridge.pow(0.55)
    const chip = mx_noise_float(p.mul(3.2).add(view.mul(near.mul(1.8).add(0.5))))
    const shown = chip.smoothstep(0.22, 0.62).mul(chip.smoothstep(0.9, 0.7))
    const lacquer = mix(color(hsl.integer(27, 86, 9)), color(hsl.integer(29, 97, 35)), carved)
    const leaf = mix(color(hsl.integer(66, 87, 37)), color(hsl.integer(89, 100, 91)), facing.pow(0.4))
    const height = carved.mul(0.1).sub(shown.mul(0.06))
    const normal = proceduralNormal(height, 1.2)
    const spark = glints(normal, 36)
    this.colorNode = mix(lacquer, leaf, shown)
    this.metalnessNode = shown.mul(0.95)
    this.roughnessNode = float(0.34).sub(shown.mul(0.26)).add(carved.oneMinus().mul(0.12)).clamp(0.05, 0.6)
    this.clearcoatNode = shown.oneMinus().mul(0.4)
    this.clearcoatRoughness = 0.05
    this.sheenNode = grazing.mul(shown.oneMinus()).mul(0.4)
    this.sheenColor.set(hsl.integer(38, 100, 80))
    this.sheenRoughness = 0.3
    this.normalNode = normal
    this.emissiveNode = leaf.mul(shown).mul(facing).mul(near.mul(0.35).add(0.4))
      .add(color(hsl.integer(94, 100, 96)).mul(spark).mul(shown).mul(0.9))
  }
}
