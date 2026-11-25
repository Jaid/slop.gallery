import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function sealScript(q: Node<'vec3'>, density: number, seed: number) {
  const g = vec2(q.x.mul(12.5).add(q.z.mul(7.4)), q.y.mul(17.5).add(q.z.mul(3.2)))
  const cell = g.floor()
  const f = g.fract().sub(0.5)
  const rnd = cellNoiseVec3(vec3(cell, seed))
  const thick = float(0.048)
  const h1 = f.y
    .sub(rnd.y.mul(0.18).sub(0.16))
    .abs()
    .smoothstep(thick.add(0.022), thick)
    .mul(f.x.abs().smoothstep(0.42, 0.34).oneMinus())
  const h2 = f.y
    .sub(rnd.z.mul(0.2).add(0.12))
    .abs()
    .smoothstep(thick.add(0.018), thick)
    .mul(f.x.abs().smoothstep(0.38, 0.3).oneMinus())
  const v1 = f.x
    .sub(rnd.x.mul(0.28).sub(0.14))
    .abs()
    .smoothstep(thick.add(0.02), thick)
    .mul(f.y.abs().smoothstep(0.44, 0.36).oneMinus())
  const v2 = f.x
    .sub(rnd.y.mul(-0.22).add(0.1))
    .abs()
    .smoothstep(thick.add(0.016), thick)
    .mul(f.y.abs().smoothstep(0.32, 0.24).oneMinus())
  const seal = f.length().sub(rnd.z.mul(0.08).add(0.16)).abs().smoothstep(0.07, 0.028)
  const present = rnd.x.smoothstep(density, density + 0.16)
  return h1.max(h2).max(v1).max(v2).max(seal.mul(rnd.y.smoothstep(0.55, 0.7))).mul(present)
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const layer0 = sealScript(p, 0.28, 3.1)
    const layer1 = sealScript(p.sub(view.mul(0.028)), 0.34, 11.7)
    const layer2 = sealScript(p.sub(view.mul(0.07)), 0.4, 23.4)
    const ghost = layer1.mul(near.mul(0.75).add(0.1))
    const deepText = layer2.mul(intimate)
    const cut = layer0.mul(near.mul(0.5).add(0.2)).max(ghost.mul(0.85)).max(deepText)
    const verdigris = mix(color(hsl.integer(167, 62, 28)), color(hsl.integer(163, 42, 62)), facing).mul(cut).mul(intimate.mul(0.7).add(0.2))
    const lacquer = mix(color(hsl.integer(27, 92, 16)), color(hsl.integer(29.5, 94, 46)), grazing.pow(1.5).mul(0.7).add(mx_noise_float(p.mul(2.2)).mul(0.08)).clamp())
    const sealed = mix(color(hsl.integer(26, 79, 9.4)), lacquer, facing.mul(0.35).add(0.45))
    this.colorNode = mix(mix(sealed, color(hsl.integer(28, 92, 24.4)), cut.mul(0.55)), verdigris, cut.mul(intimate).mul(0.65))
    this.metalnessNode = cut.mul(0.15)
    this.roughnessNode = float(0.22).mix(0.12, cut).add(grazing.mul(0.05))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.normalNode = proceduralNormal(cut.mul(0.55).add(mx_noise_float(p.mul(12)).mul(0.12)), 0.0014)
    this.iridescence = 0.12
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = facing.mul(80).add(160)
    this.emissiveNode = color(hsl.integer(27, 85, 13))
      .mul(rim)
      .mul(0.18)
      .add(color(hsl.integer(38, 100, 65.6)).mul(cut).mul(intimate).mul(0.22))
      .add(verdigris.mul(0.35).mul(near))
  }
}
