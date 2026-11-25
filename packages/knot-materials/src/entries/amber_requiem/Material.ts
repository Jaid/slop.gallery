import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Amber Requiem. Fossil resin, forty million years old, polished to a waxen shine. It is warm and translucent, so the light that gets in wanders a long way before it comes back out, and everything the resin swallowed on the day it was still sticky is still in there: bubbles, plant dust, and the occasional small insect, legs and all. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
// Resin flowed before it set, and the flow lines are still visible.
    const flow = mx_fractal_noise_float(p.mul(3.6).add(vec3(0, p.y.mul(1.5), 0)), 3, 2, 0.5)
    const cloud = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
// Inclusions sit at their own depth, so they parallax as the eye moves.
    const inner = p.sub(view.mul(0.06))
// Bubbles of trapped air.
    const bubbles = cellularPoints(inner.mul(26), 0.05, 0.2, 0.55)
// A small insect, curled where the resin caught it.
    const q = inner.mul(5.5)
    const cell = q.floor()
    const id = cellNoiseVec3(cell)
    const local = q.fract().sub(0.5)
    const angle = id.y.mul(TAU)
    const c = angle.cos()
    const s = angle.sin()
    const rx = local.x.mul(c).sub(local.y.mul(s))
    const ry = local.x.mul(s).add(local.y.mul(c))
    const bodyDist = vec2(rx.div(0.3), ry.div(0.12)).length()
    const insectBody = bodyDist.smoothstep(0.85, 1.05).oneMinus()
    const headDist = vec2(rx.sub(0.36).div(0.1), ry.div(0.1)).length()
    const head = headDist.smoothstep(0.85, 1.05).oneMinus()
    let legs: Node<'float'> = float(0)
    for (const a of [0.7, 1.2, 1.7, -0.7, -1.2, -1.7]) {
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      const along = rx.mul(dx).add(ry.mul(dy))
      const across = rx.mul(-dy).add(ry.mul(dx))
      legs = legs.max(filament(across, 0.006).mul(along.smoothstep(0.02, 0.06)).mul(along.smoothstep(0.2, 0.26).oneMinus()))
    }
    const insect = insectBody.max(head).max(legs.mul(0.75)).mul(id.x.smoothstep(0.97, 0.985))
// Plant dust and grit suspended in the resin.
    const dust = cellularPoints(inner.mul(70), 0.02, 0.1, 0.72).mul(0.5)
    const amberBase = mix(color(hsl.integer(47, 100, 38)), color(hsl.integer(68, 94, 65)), flow.mul(0.5).add(0.5))
    const body = mix(amberBase, color(hsl.integer(54, 76, 16)), insect.mul(0.9))
    this.colorNode = mix(body, color(hsl.integer(77, 84, 74)), cloud.mul(0.06))
    this.metalness = 0
    this.roughnessNode = float(0.04).add(cloud.mul(0.03)).add(insect.mul(0.1))
    this.transmission = 0.95
    this.thickness = 0.5
    this.ior = 1.55
    this.attenuationColor.set(hsl.integer(51, 100, 52.4))
    this.attenuationDistance = 0.5
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.03
    this.normalNode = proceduralNormal(flow.mul(0.12).add(bubbles.mul(0.2)), 0.0006)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = color(hsl.integer(57.5, 100, 71)).mul(flow.mul(0.5).add(0.5)).mul(0.35)
      .add(color(hsl.integer(78, 100, 89)).mul(bubbles).mul(near.mul(0.3).add(0.7)).mul(0.5))
      .add(color(hsl.integer(72, 100, 79.1)).mul(dust).mul(0.35))
      .add(color(hsl.integer(81, 100, 84)).mul(grazing.pow(1.6)).mul(1.3))
  }
}
