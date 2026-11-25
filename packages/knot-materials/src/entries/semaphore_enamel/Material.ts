import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, uv, vec2} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const grid = uv().mul(vec2(28, 6))
    // Derivatives must precede fract/floor, otherwise tile edges bloom at a distance.
    const footprint = grid.fwidth().length().max(0.0001)
    const filter = footprint.min(0.04)
    const detail = footprint.smoothstep(0.25, 0.8).oneMinus()
    const tile = grid.floor()
    const local = grid.fract().sub(0.5)
    const corner = local.abs().sub(vec2(0.35, 0.32)).max(0).length()
    const rim = corner.smoothstep(0.095, filter.add(0.095)).oneMinus()
    const enamel = corner.smoothstep(0.062, filter.add(0.062)).oneMinus()
    const parity = tile.x.add(tile.y).mod(2)
    const diagonal = local.x.add(mix(local.y, local.y.negate(), parity))
      .smoothstep(filter.negate(), filter)
    const field = mix(color(hsl.integer(250, 53, 20)), color(hsl.integer(31, 88, 54.6)), parity)
    const flag = mix(field, color(hsl.integer(85, 55, 91)), diagonal)
    // A small circular countermark and two registration bars give each panel a face.
    const dot = local.sub(vec2(-0.2, 0.18)).length()
      .smoothstep(0.052, filter.add(0.052)).oneMinus()
    const bars = local.y.add(0.24).abs().smoothstep(0.018, filter.add(0.018)).oneMinus()
      .mul(local.x.abs().sub(0.2).abs().smoothstep(0.032, filter.add(0.032)).oneMinus())
    const marked = mix(flag, field, dot).add(color(hsl.integer(86, 68, 81)).mul(bars).mul(0.25))
    const brass = color(hsl.integer(78, 57, 58))
    const panel = mix(brass, marked, enamel)
    this.colorNode = mix(color(hsl.integer(228, 40, 15)), panel, rim)
    this.metalnessNode = rim.sub(enamel).clamp().mul(0.8)
    this.roughnessNode = mix(float(0.5), float(0.24), enamel)
    this.clearcoatNode = enamel.mul(0.85)
    this.clearcoatRoughness = 0.12
    // Broad, shallow pillow relief rather than an unrealistically embossed flag.
    const pillow = local.x.mul(Math.PI).cos().mul(local.y.mul(Math.PI).cos())
    this.normalNode = proceduralNormal(enamel.mul(pillow).mul(detail), 0.0007)
    this.clearcoatNormalNode = normalViewGeometry
  }
}
