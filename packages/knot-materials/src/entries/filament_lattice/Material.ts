import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, uv} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    // Six filaments run the length of the tube, crossed by sparse rungs.
    const strands = filament(tube.y.mul(6).fract().sub(0.5), 0.055)
    const rungs = filament(tube.x.mul(90).fract().sub(0.5), 0.04).mul(0.7)
    const lattice = strands.max(rungs)
    // A slow current travels along the strands and heats them as it passes.
    const current = tube.x.mul(2.5).sub(time.mul(0.09)).fract()
    const heat = current.smoothstep(0, 0.35).mul(current.smoothstep(0.75, 0.42)).clamp()
    const grit = mx_noise_float(p.mul(30)).mul(0.5).add(0.5)
    const glow = mix(color(hsl.integer(40, 100, 22)), color(hsl.integer(78, 100, 89)), heat.pow(0.7))
    this.colorNode = mix(color(hsl.integer(268, 13, 10)), color(hsl.integer(67, 25, 15)), lattice).mul(grit.mul(0.12).add(0.94))
    this.metalnessNode = lattice.mul(0.7).add(0.15)
    this.roughnessNode = lattice.oneMinus().mul(0.3).add(grit.mul(0.08)).add(0.18)
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.2
    this.normalNode = proceduralNormal(lattice.mul(0.5).add(grit.mul(0.2)), 0.0018)
    this.emissiveNode = glow.mul(lattice).mul(heat.mul(2.4).add(0.12)).mul(near.mul(0.35).add(0.75)).add(color(hsl.integer(49, 100, 67.9)).mul(grazing.pow(3)).mul(0.18))
  }
}
