import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, positionGeometry, time, uv, vec2} from 'three/tsl'

import {stroke, tile} from '../../candidates/gpt_sol/lib/ornament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.23)
    this.name = knotData.id
    const {grazing, near, view} = viewerFrame()
    const q = tile(uv(), 4, 2).sub(vec2(0.5, 0.5))
    const r = q.length().max(0.0001)
    const angle = mx_atan2(q.y, q.x) as Node<'float'>
    const motion = time.mul(0.3)
    const turbulence = mx_noise_float(positionGeometry.mul(10).add(motion)).mul(0.015)
    const coronaR = r.add(turbulence)
    const disk = r.smoothstep(0.255, 0.28).oneMinus()
    const rim = stroke(coronaR.sub(0.274), 0.012)
    const outer = stroke(coronaR.sub(0.37), 0.006)
    const filaments = angle.mul(25).add(r.mul(19)).add(time.mul(0.55)).sin().abs().pow(12).mul(r.smoothstep(0.28, 0.3)).mul(r.smoothstep(0.42, 0.49).oneMinus())
    const halo = r.sub(0.29).div(0.18).pow2().negate().exp().mul(0.42)
    const trace = angle.mul(12).sub(time.mul(0.13)).cos().mul(0.5).add(0.5)
    const velvet = mix(color(hsl.integer(297, 42, 5)), color(hsl.integer(355, 60, 13)), trace.mul(0.21).add(grazing.mul(0.23)))
    this.colorNode = mix(velvet, color(hsl.integer(326, 25, 4)), disk.mul(0.95)).add(color(hsl.integer(5, 68, 16)).mul(halo).mul(0.35))
    this.metalness = 0.04
    this.roughnessNode = float(0.91).sub(rim.mul(0.65)).sub(outer.mul(0.25))
    this.sheenNode = float(0.25)
    this.sheenRoughness = 0.91
    this.clearcoatNode = rim.mul(0.25)
    this.clearcoatRoughness = 0.14
    this.normalNode = proceduralNormal(halo.mul(0.15).add(filaments.mul(0.16)), 0.006)
    const fire = mix(color(hsl.integer(32.6, 100, 61)), color(hsl.integer(75, 100, 87)), r.smoothstep(0.26, 0.33))
    this.emissiveNode = fire.mul(rim.mul(1.2).add(filaments.mul(0.85)).add(halo.mul(0.39)).add(outer.mul(0.27))).mul(near.mul(0.3).add(0.85)).add(color(hsl.integer(357, 70, 74)).mul(grazing.pow(3)).mul(0.16)).add(color(hsl.integer(59, 66, 91)).mul(rim).mul(view.z.abs().pow(7)).mul(0.09))
  }
}
