import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, positionGeometry, time, uv, vec2} from 'three/tsl'

import {stroke, tile} from '../../candidates/gpt_sol/lib/ornament.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.92)
    this.name = knotData.id
    const {p, grazing, near, view} = viewerFrame()
    const q = tile(uv().add(vec2(view.x.mul(0.004), view.y.mul(0.006))), 4, 2).sub(vec2(0.5, 0.5))
    const r = q.length().max(0.00001)
    const angle = mx_atan2(q.y, q.x) as Node<'float'>
    const spoke = angle.mul(3).sin().abs().mul(r)
    const crystal = stroke(spoke, 0.009).mul(r.smoothstep(0.07, 0.1)).mul(r.smoothstep(0.36, 0.41).oneMinus())
    let branches: Node<'float'> = float(0)
    for (const radius of [0.15, 0.22, 0.29]) {
      const distance = r.sub(radius).abs()
      const arms = spoke.sub(distance.mul(0.57)).abs().min(spoke.add(distance.mul(0.57)).abs())
      branches = branches.max(stroke(arms, 0.006).mul(distance.smoothstep(0.055, 0.085).oneMinus()).mul(spoke.smoothstep(0.015, 0.02)))
    }
    const core = r.smoothstep(0.012, 0.044).oneMinus()
    const ring = stroke(r.sub(0.38), 0.003)
    const fracture = cellularBoundary(p.mul(9)).smoothstep(0.012, 0.04).oneMinus().mul(0.3)
    const frost = crystal.add(branches).add(core).add(ring).add(fracture.mul(near)).clamp()
    const grain = mx_noise_float(positionGeometry.mul(35)).mul(0.5).add(0.5)
    const traveling = angle.mul(6).sub(time.mul(0.58)).cos().mul(0.5).add(0.5).pow(6)
    this.colorNode = mix(color(hsl.integer(241, 53, 22)), color(hsl.integer(206, 36, 85)), grain.mul(0.35).add(frost.mul(0.6)))
    this.metalness = 0.17
    this.roughnessNode = float(0.34).add(grain.mul(0.22)).sub(frost.mul(0.21))
    this.clearcoat = 0.95
    this.clearcoatRoughness = 0.085
    this.ior = 1.38
    this.iridescenceNode = grazing.mul(0.48)
    this.iridescenceThicknessNode = float(180).add(grain.mul(100))
    this.normalNode = proceduralNormal(grain.mul(0.19).add(frost.mul(0.65)), 0.0014)
    this.emissiveNode = color(hsl.integer(223, 100, 90.5)).mul(frost).mul(0.23).add(color(hsl.integer(0, 0, 100)).mul(crystal.add(branches)).mul(traveling).mul(0.56)).add(color(hsl.integer(225, 100, 83)).mul(grazing.pow(3)).mul(0.21))
  }
}
