import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, uv, vec2, vec3} from 'three/tsl'

import {buriedUv} from '../../candidates/gpt_sol/lib/exhibition/buriedOptics.ts'
import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {fill, stroke, tiles, wave} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A rounded doorway with straight jambs, a semicircular crown and a closed sill. */
function arch(p: Node<'vec2'>) {
  return vec2(p.x, p.y.sub(0.015).max(0)).length().sub(0.3).max(p.y.negate().sub(0.365))
}

/** Seven mutually occluding arcades, with physical-unit parallax and deliberately lit interiors. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const tube = uv()
    const {view, near, intimate} = viewerFrame()
    const front = tiles(tube, [18, 2], 31)
    let scene: Node<'vec3'> = color(hsl.integer(274, 21, 16)).mul(1)
    let lamps: Node<'vec3'> = vec3(0)
    let frontOpening: Node<'float'> = float(0)
    let frontRelief: Node<'float'> = float(0)
    for (let i = 6;i >= 0;i--) {
      const shrink = 0.77 ** i
      const layer = tiles(buriedUv(tube, view, i * 0.017, 1.18), [18, 2], 31)
      const p = layer.local.div(shrink)
      const distance = arch(p)
      const opening = fill(distance)
      const moulding = stroke(distance.sub(0.038), 0.018)
      const bevel = stroke(distance, 0.032)
      const crown = stroke(distance.sub(0.077), 0.009)
      const vertical = wave(p.x.mul(150)).mul(p.x.abs().smoothstep(0.29, 0.34))
      const mortarY = stroke(p.y.add(0.5).mul(7).fract().sub(0.5), 0.009)
      const mortarX = stroke(p.x.mul(7).add(p.y.mul(7).floor().mod(2).mul(0.5)).fract().sub(0.5), 0.009)
      const joints = mortarY.max(mortarX.mul(0.42)).mul(moulding.mul(0.8).oneMinus())
      const sideLight = p.x.mul(-0.7).add(0.6).clamp()
      let stone: Node<'vec3'> = mix(color(hsl.integer(165, 3, 60)), color(hsl.integer(85, 100, 95.6)), sideLight)
        .mul(Math.exp(-i * 0.48) * 0.97)
      stone = mix(stone, color(hsl.integer(197, 5, 38)).mul(0.5), joints.mul(0.16))
      stone = stone.mul(vertical.mul(0.1).add(0.9))
      stone = mix(stone, color(hsl.integer(78, 62, 61)).mul(0.8), crown.mul(0.7))
      stone = stone.add(color(hsl.integer(86, 100, 95)).mul(moulding).mul(0.065))
// A recessed clerestory lamp at each crown and thin reflected light along each sill.
      const lampP = p.sub(vec2(0, 0.367))
      const lamp = fill(vec2(lampP.x.div(0.036), lampP.y.div(0.012)).length().sub(1))
      const sill = stroke(p.y.add(0.347), 0.006).mul(fill(p.x.abs().sub(0.27)))
      const pulse = exhibitionPhase.mul(2).add(front.random.y.mul(6)).add(i * 0.6).sin().mul(0.12).add(0.88)
      const light = color(hsl.integer(83, 100, 88.6)).mul(lamp.mul(0.6).add(sill.mul(0.06))).mul(pulse)
      scene = mix(stone, scene, opening)
      lamps = lamps.mul(opening).add(light)
      if (!(i === 0)) {
        continue
      }
      frontOpening = opening
      frontRelief = moulding.mul(0.0015).add(bevel.mul(0.0008)).add(crown.mul(0.00045)).add(vertical.mul(0.0002)).sub(joints.mul(0.00012))
    }
// Small brass rosettes in the spandrels establish scale even before the rooms become legible.
    const rosetteP = front.local.sub(vec2(0.395, 0.34))
    const radius = rosetteP.length()
    const rosette = stroke(radius.sub(0.033), 0.006).max(stroke(radius.sub(0.014), 0.004))
    this.colorNode = mix(scene, color(hsl.integer(85, 59, 70)), rosette)
    this.metalnessNode = rosette.mul(0.82)
    this.roughnessNode = mix(float(0.51), float(0.24), rosette)
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.28
    this.normalNode = proceduralNormal(frontRelief.add(rosette.mul(0.0004)), 1)
    this.aoNode = frontOpening.mul(0.32).oneMinus()
    this.emissiveNode = scene.mul(frontOpening).mul(0.13).add(lamps.mul(near.mul(0.15).add(0.85)))
      .add(color(hsl.integer(82, 100, 93.5)).mul(rosette).mul(intimate).mul(0.025))
  }
}
