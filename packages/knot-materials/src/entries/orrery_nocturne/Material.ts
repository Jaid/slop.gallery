import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, time, uv, vec2} from 'three/tsl'

import {jewel, stroke, tile} from '../../candidates/gpt_sol/lib/ornament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Moving engraved epicycles that appear to turn below a midnight enamel dial. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {grazing, near, view} = viewerFrame()
    const q = tile(uv(), 4, 2).sub(vec2(0.5, 0.5))
    const r = q.length().max(0.00001)
    const angle = mx_atan2(q.y, q.x) as Node<'float'>
    const dial = r.smoothstep(0.44, 0.46).oneMinus()
    const mainRim = stroke(r.sub(0.425), 0.013)
    const innerRim = stroke(r.sub(0.13), 0.006)
    const orbitA = stroke(r.sub(0.29), 0.0045)
    const orbitB = stroke(r.sub(0.365), 0.0035)
    const ticks = angle.mul(48).sin().abs().pow(16).mul(r.sub(0.385).abs().smoothstep(0.006, 0.026).oneMinus())
    const major = angle.mul(12).sin().abs().pow(18).mul(r.sub(0.376).abs().smoothstep(0.005, 0.04).oneMinus())
    const spinning = time.mul(0.23).add(view.z.mul(0.045))
    const a = vec2(spinning.cos(), spinning.sin()).mul(0.29)
    const b = vec2(spinning.mul(-0.6).add(2.1).cos(), spinning.mul(-0.6).add(2.1).sin()).mul(0.365)
    const planetA = q.sub(a).length().smoothstep(0.023, 0.031).oneMinus()
    const planetB = q.sub(b).length().smoothstep(0.014, 0.023).oneMinus()
    const hub = jewel(q, [0, 0], 0.045)
    const engravings = mainRim.add(innerRim).add(orbitA).add(orbitB).add(ticks.mul(0.5)).add(major).add(hub).clamp()
    const brushed = angle.mul(80).sin().mul(0.5).add(0.5)
    this.colorNode = mix(mix(mix(color(hsl.integer(269, 58, 7.5)), color(hsl.integer(253, 42, 27)), brushed.mul(0.19).add(grazing.mul(0.24))), color(hsl.integer(67, 57, 61)), engravings.mul(0.86)), color(hsl.integer(80, 46, 84)), planetA.add(planetB).clamp())
    this.metalness = 0.91
    this.roughnessNode = float(0.22).sub(engravings.mul(0.08)).add(dial.oneMinus().mul(0.12))
    this.clearcoat = 0.78
    this.clearcoatRoughness = 0.056
    this.anisotropy = 0.43
    this.normalNode = proceduralNormal(engravings.mul(0.5).add(dial.mul(0.18)), 0.0012)
    this.emissiveNode = color(hsl.integer(74, 76, 80)).mul(planetA.mul(1.3).add(planetB).add(hub.mul(0.14))).add(color(hsl.integer(219, 73, 79)).mul(orbitA.add(orbitB)).mul(near.mul(0.16).add(0.07))).add(color(hsl.integer(77, 71, 86)).mul(mainRim).mul(grazing.pow(4)).mul(0.18))
  }
}
