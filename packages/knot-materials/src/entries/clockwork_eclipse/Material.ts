import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A few broad brass teeth under a moving eclipse. The lit limb is a thin ring that follows you; nearness uncovers a second, finer gear inside the shadow. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.08)
    this.name = knotData.id
    const {facing, grazing, near, intimate, view} = viewerFrame()
    const tube = uv()
    const teethPhase = tube.x.mul(TAU * 7).add(time.mul(0.18))
    const tooth = teethPhase.sin().max(0).pow(0.8)
    const resolved = teethPhase.fwidth().smoothstep(1.6, 0.25)
    const gear = mix(float(0.15), tooth, resolved)
    const finePhase = tube.y.mul(TAU * 14).sub(time.mul(0.3))
    const pinion = finePhase.sin().max(0).pow(2).mul(finePhase.fwidth().smoothstep(1.3, 0.2)).mul(near)
    const eclipse = view.dot(vec3(0.15, 0.1, 1).normalize()).mul(0.5).add(0.5)
    const lit = eclipse.smoothstep(0.12, 0.7)
    const limb = eclipse.sub(0.42).abs().div(0.035).smoothstep(1, 0)
    const brass = mix(color(hsl.integer(47, 42, 11)), color(hsl.integer(69, 70, 72.5)), gear.mul(0.75).add(facing.mul(0.2)))
    const body = mix(color(hsl.integer(273, 17, 5)), brass.mul(0.45), lit.mul(0.7))
    const height = gear.mul(0.08).add(pinion.mul(0.02))
    const normal = proceduralNormal(height, 1)
    const spark = glints(normal, 55)
    this.colorNode = body
    this.metalnessNode = float(0.78).mul(lit).add(0.15)
    this.roughnessNode = float(0.62).sub(gear.mul(0.2)).clamp(0.3, 0.8)
    this.anisotropyNode = resolved.mul(0.7)
    this.anisotropyRotation = Math.PI * 0.5
    this.normalNode = normal
    this.emissiveNode = color(hsl.integer(71, 100, 85)).mul(limb).mul(intimate.mul(0.5).add(0.8)).mul(1.8)
      .add(color(hsl.integer(85, 100, 95.5)).mul(spark).mul(lit).mul(gear.add(0.2)).mul(0.35))
      .add(color(hsl.integer(73, 100, 88.5)).mul(pinion).mul(lit).mul(0.8))
      .add(color(hsl.integer(56, 24, 7)).mul(grazing).mul(lit.oneMinus()).mul(0.02))
  }
}
