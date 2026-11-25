import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv, vec2} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Fitted triangular veneers, pale stringing and alternating end-grain direction. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, near} = viewerFrame()
    // Integer repeat counts close both UV seams. Every discontinuity sits beneath a joint.
    const q = uv().mul(vec2(24, 4))
    const cell = q.fract()
    const identity = q.floor()
    const footprint = q.fwidth().length().max(0.0001)
    const resolved = footprint.smoothstep(0.3, 1).oneMinus()
    const diagonal = cell.x.sub(cell.y)
    const triangle = diagonal.smoothstep(footprint.negate(), footprint)
    const alternate = identity.x.add(identity.y).mod(2)
    const side = mix(triangle, triangle.oneMinus(), alternate)
    const edge = cell.min(cell.oneMinus()).x.min(cell.min(cell.oneMinus()).y).min(diagonal.abs().mul(Math.SQRT1_2))
    const veneer = edge.smoothstep(0.018, footprint.add(0.028))
    const stringing = edge.smoothstep(0.004, footprint.add(0.009)).mul(veneer.oneMinus())
    const across = mix(cell.x, cell.y, side)
    const along = mix(cell.y, cell.x, side)
    const grainPhase = across.mul(110).add(along.mul(8).sin().mul(2.2))
    const grain = opticalBands(grainPhase)
    const poreQ = p.mul(180)
    const poreVisibility = poreQ.fwidth().length().smoothstep(0.35, 1.2).oneMinus().mul(near)
    const pores = mx_noise_float(poreQ).smoothstep(0.32, 0.65).mul(poreVisibility).mul(resolved)
    const maple = mix(color(hsl.integer(71, 60, 71)), color(hsl.integer(80, 69, 84)), grain.mul(0.65))
    const rosewood = mix(color(hsl.integer(33, 55, 24)), color(hsl.integer(47, 60, 51)), grain.mul(0.72).add(0.12))
    const wood = mix(maple, rosewood, side).mul(pores.mul(-0.16).add(1))
    const joint = mix(color(hsl.integer(50, 26, 16)), color(hsl.integer(85, 52, 83)), stringing)
    this.colorNode = mix(color(hsl.integer(60, 54, 54)), mix(joint, wood, veneer), resolved)
    this.metalness = 0
    this.ior = 1.46
    this.specularIntensity = 0.6
    this.roughnessNode = float(0.32).add(grain.mul(0.08)).add(veneer.oneMinus().mul(0.2))
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.22
    // In r186 anisotropyNode is a tangent-space vector whose length is the strength.
    this.anisotropy = 0.45
    this.anisotropyNode = vec2(side, side.oneMinus()).normalize().mul(veneer).mul(resolved).mul(0.45)
    const height = veneer.mul(0.0008).add(grain.mul(0.00012).mul(veneer)).sub(pores.mul(0.00015)).mul(resolved)
    this.normalNode = proceduralNormal(height, 1)
  }
}
