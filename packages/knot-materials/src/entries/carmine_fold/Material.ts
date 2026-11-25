import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2} from 'three/tsl'

import {resolved, ruled, stroke} from '../../candidates/gpt_astra/lib/surface/coverage.ts'
import {exhibitionFrame} from '../../candidates/gpt_astra/lib/surface/frame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

/** A tessellated paper relief. The triangle slopes remain planar instead of being noise-bumped. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, near, intimate, grazing} = exhibitionFrame()
    const grid = uv().mul(vec2(32, 4))
    const q = grid.fract().sub(0.5)
    const aa = grid.fwidth().length()
    const pyramid = q.x.abs().max(q.y.abs()).mul(-2).add(1)
    const breath = time.mul(0.42).sin().mul(0.065).add(0.935)
    // This field is continuous across every shared panel boundary, including both UV seams.
    const height = pyramid.mul(breath).mul(0.018)
    this.positionNode = positionGeometry.add(normalLocal.mul(height))
    const seamDistance = q.x.abs().max(q.y.abs()).oneMinus().sub(0.5)
    const valley = stroke(seamDistance, 0.014, aa)
    const diagonal = stroke(q.x.abs().sub(q.y.abs()), 0.006, aa)
    const facet = q.x.abs().sub(q.y.abs()).smoothstep(aa.negate(), aa)
    const alternation = grid.x.floor().add(grid.y.floor()).mod(2)
    const vermilion = mix(color(hsl.integer(24, 89, 39)), color(hsl.integer(33, 87, 56.4)), facet.mul(0.45).add(alternation.mul(0.22)))
    const lightPaper = mix(vermilion, color(hsl.integer(40, 83, 70)), pyramid.mul(0.14).add(grazing.mul(0.1)))
    const paperEdge = valley.mul(0.72).add(diagonal.mul(0.22)).clamp()
    const fibers = mx_noise_float(p.mul(300)).mul(intimate)
    const laid = ruled(uv().x.mul(1500), 0.11).mul(resolved(uv().mul(vec2(1500, 1))))
    this.colorNode = mix(lightPaper, color(hsl.integer(73, 55, 85.6)), paperEdge)
      .mul(fibers.mul(0.075).add(laid.mul(0.026)).add(0.96))
    this.metalness = 0
    this.roughnessNode = float(0.72).sub(pyramid.mul(0.12)).add(paperEdge.mul(0.08))
    this.sheenNode = color(hsl.integer(41, 76, 71)).mul(0.26)
    this.sheenRoughness = 0.72
    this.clearcoat = 0.035
    this.clearcoatRoughness = 0.65
    this.normalNode = proceduralNormal(height.add(fibers.mul(0.000025)).add(laid.mul(0.000018)), 0.95)
    this.aoNode = valley.mul(-0.22).add(0.98)
    // A small wrap-light term suggests the warm translucency of very thin paper, not a light source.
    this.emissiveNode = color(hsl.integer(33, 89, 53)).mul(grazing.pow(3)).mul(near.mul(0.4).add(0.6)).mul(0.045)
  }
}
