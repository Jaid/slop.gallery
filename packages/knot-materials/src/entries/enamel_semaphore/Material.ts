import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionGeometry, uv, vec2} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const panels = uv().mul(vec2(12, 2))
    const local = panels.fract().sub(0.5)
    const footprint = panels.fwidth().length().max(0.0001)
    const row = panels.y.floor().mod(2)
    const column = panels.x.floor().mod(3)
    // Three flag grammars: diagonal bicolor, a cross and a quartered swallowtail chevron.
    const diagonal = local.x.add(local.y).smoothstep(footprint.negate(), footprint)
    const cross = local.x.abs().min(local.y.abs()).sub(0.11).smoothstep(footprint.negate(), footprint).oneMinus()
    const chevron = local.x.abs().sub(local.y.abs()).smoothstep(footprint.negate(), footprint)
    const navy = color(hsl.integer(247, 61, 19))
    const ivory = color(hsl.integer(91, 54, 94))
    const red = color(hsl.integer(33, 92, 58))
    const saffron = color(hsl.integer(84, 93, 80))
    const first = mix(mix(ivory, red, row), mix(red, ivory, row), diagonal)
    const second = mix(ivory, navy, cross)
    const third = mix(navy, saffron, chevron)
    const flag = mix(mix(first, second, column.step(0.5)), third, column.step(1.5))
    // Raised nickel-silver frames surround softly recessed vitreous panels.
    const borderDistance = float(0.5).sub(local.x.abs().max(local.y.abs()))
    const enamel = borderDistance.smoothstep(footprint.add(0.022), footprint.add(0.047))
    const insetShadow = borderDistance.smoothstep(0.028, 0.075)
    const peel = mx_noise_float(positionGeometry.mul(95))
    const peelVisibility = positionGeometry.mul(95).fwidth().length().smoothstep(0.4, 2).oneMinus()
    this.colorNode = mix(color(hsl.integer(87, 22, 75)), flag.mul(insetShadow.mul(0.16).add(0.84)), enamel)
    this.metalnessNode = enamel.oneMinus().mul(0.92)
    this.roughnessNode = mix(float(0.26), float(0.17), enamel).add(peel.mul(peelVisibility).mul(0.018))
    this.clearcoatNode = enamel.mul(0.92)
    this.clearcoatRoughness = 0.075
    this.normalNode = proceduralNormal(enamel.mul(-0.00055).add(peel.mul(peelVisibility).mul(0.00008)), 1)
    this.ior = 1.5
  }
}
