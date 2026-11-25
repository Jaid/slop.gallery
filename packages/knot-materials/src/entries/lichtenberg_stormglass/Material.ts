import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function lichtenberg(p: Node<'vec3'>, t: Node<'float'>) {
  const drift = vec3(t.mul(0.06), t.mul(-0.035), t.mul(0.048))
  const warp = mx_noise_vec3(p.mul(2.15).add(drift))
  const q = p.mul(3.4).add(warp.mul(0.92))
  const trunkField = mx_noise_float(q)
  const branchField = mx_noise_float(q.mul(2.35).add(warp.mul(1.25)))
  const hairField = mx_noise_float(q.mul(5.8).sub(drift.mul(2)))
  return {
    trunk: trunkField.abs().smoothstep(0.11, 0).pow(1.35),
    branch: branchField.abs().smoothstep(0.075, 0).pow(1.7),
    hair: hairField.abs().smoothstep(0.045, 0).pow(2.1),
    field: trunkField,
  }
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const inner = p.sub(view.mul(0.16))
    const deep = p.sub(view.mul(0.3))
    const bolt = lichtenberg(inner, time)
    const echo = lichtenberg(deep, time.mul(0.72).add(2.7))
    const surge = time.mul(1.55).sin().mul(0.5).add(0.5).pow(9)
    const flicker = time.mul(41).sin().abs()
    const crawl = intimate.mul(0.22).add(near.mul(0.12))
    const live = surge.mul(flicker.mul(0.55).add(0.45)).add(crawl)
    const glassFog = mx_fractal_noise_float(inner.mul(3.1), 3, 2, 0.5).mul(0.5).add(0.5)
    const burns = bolt.trunk.max(bolt.branch.mul(0.7)).max(echo.trunk.mul(0.45))
    const silica = mix(color(hsl.integer(254, 23, 7)), color(hsl.integer(249, 33, 18)), glassFog.mul(grazing).mul(0.6).add(0.2))
    this.colorNode = mix(silica, color(hsl.integer(262, 10, 5)), burns.mul(0.55))
    this.transmissionNode = burns.oneMinus().mul(facing.mul(0.35).add(0.55)).mul(near.mul(-0.15).add(0.92))
    this.thickness = 0.55
    this.ior = 1.48
    this.dispersion = 0.42
    this.attenuationColor.set(hsl.integer(257, 58, 22))
    this.attenuationDistance = 0.45
    this.roughnessNode = burns.mul(0.22).add(0.04)
    this.metalnessNode = burns.mul(0.25)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.normalNode = proceduralNormal(bolt.field.mul(0.4).add(glassFog.mul(0.2)), 0.0024)
    this.emissiveNode = color(hsl.integer(250, 100, 96))
      .mul(bolt.trunk)
      .mul(live.add(0.1))
      .mul(1.8)
      .add(color(hsl.integer(263, 100, 69)).mul(bolt.branch).mul(live.add(0.08)).mul(1.35))
      .add(color(hsl.integer(299, 100, 67)).mul(bolt.hair).mul(near.mul(0.8).add(intimate)))
      .add(color(hsl.integer(252, 100, 80)).mul(echo.trunk).mul(live).mul(0.55))
      .add(color(hsl.integer(265, 48, 35)).mul(rim).mul(0.12))
  }
}
