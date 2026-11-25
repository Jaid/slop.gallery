import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Nacre combed along the tube. The comb’s angle follows the viewer, so the color runs as you circle, and the grooves deepen into shadow when you come close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.06)
    this.name = knotData.id
    const {p, grazing, near, view} = viewerFrame()
    const tube = uv()
    const lean = view.dot(vec3(1, 0.2, 0.4))
    const phase = tube.x.mul(TAU * 6).add(tube.y.mul(TAU * 18)).add(lean.mul(near.mul(2).add(0.6)))
    const groove = phase.sin().mul(0.5).add(0.5)
    const resolved = phase.fwidth().smoothstep(0.3, 1.8).oneMinus()
    const bands = mix(float(0.5), groove, resolved)
    // The slower rainbow needs its own integer cycles, not a fractional groove phase.
    const colorPhase = tube.x.mul(TAU * 2).add(tube.y.mul(TAU * 6)).add(lean.mul(near.mul(2).add(0.6)).mul(0.35))
    const nacre = spectralColor(colorPhase.add(grazing.mul(2)).add(lean))
    const height = bands.mul(resolved).mul(0.5).add(mx_noise_float(p.mul(vec3(8, 30, 8))).mul(0.08))
    this.colorNode = nacre.mul(bands.mul(0.6).add(0.35))
    this.roughness = 1
    this.metalness = 0.06
    this.iridescence = 1
    this.iridescenceIORNode = float(1.3).add(grazing.mul(0.2))
    this.iridescenceThicknessNode = float(80).add(bands.mul(460)).add(near.mul(90))
    this.clearcoat = 0
    this.sheenNode = grazing.mul(0.8)
    this.sheenColor.set(hsl.integer(77, 100, 96.4))
    this.sheenRoughness = 0.35
    this.normalNode = proceduralNormal(height, 0.025)
    this.emissiveNode = nacre.mul(bands).mul(grazing).mul(0.4)
  }
}
