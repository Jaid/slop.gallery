import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {polarAngle} from '../../candidates/gpt_astra/lib/surface/angle.ts'
import {fill, resolved, ruled, stroke, wave} from '../../candidates/gpt_astra/lib/surface/coverage.ts'
import {exhibitionFrame} from '../../candidates/gpt_astra/lib/surface/frame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** Cut-pile damask over a real interlaced height field, not a metallic noise recolor. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, near, intimate, grazing, tangent, V} = exhibitionFrame()
    const tube = uv()
    const cloth = tube.mul(vec2(480, 80))
    const warp = wave(cloth.x.mul(TAU)).pow(0.65)
    const weft = wave(cloth.y.mul(TAU)).pow(0.65)
    const twill = cloth.x.floor().add(cloth.y.floor().mul(2)).mod(5).lessThan(2).select(1, 0)
    const fiber = mix(warp.mul(0.65).add(weft.mul(0.25)), weft.mul(0.65).add(warp.mul(0.25)), twill)
    const threadDetail = resolved(cloth)
    // Six-lobed embroidered flowers and a continuous, sinuous connecting vine.
    const garden = tube.mul(vec2(24, 4))
    const q = garden.fract().sub(0.5)
    const radius = q.mul(vec2(1, 1.04)).length().max(0.0001)
    const theta = polarAngle(q)
    const petal = radius.sub(theta.mul(6).cos().mul(0.065).add(0.255))
    const aa = garden.fwidth().length()
    const flower = fill(petal, aa)
    const embroidery = stroke(petal, 0.012, aa).add(stroke(petal.add(0.038), 0.005, aa).mul(0.6))
    const heart = stroke(radius.sub(0.069), 0.012, aa).add(fill(radius.sub(0.028), aa))
    const vinePhase = tube.x.mul(TAU * 12).add(tube.y.mul(TAU * 4).sin().mul(1.5))
    const vine = stroke(vinePhase.sin(), 0.042).mul(flower.oneMinus())
    const gold = embroidery.add(heart).add(vine.mul(0.6)).clamp()
    const stitch = ruled(cloth.x.add(cloth.y.mul(0.5)), 0.18)
    const breath = tube.x.mul(TAU * 3).sub(time.mul(0.28)).sin().mul(0.5).add(0.5)
    const nap = V.dot(tangent).abs().oneMinus().pow(3)
    const shot = nap.mul(0.58).add(grazing.mul(0.28)).add(breath.mul(0.08)).clamp()
    const plum = mix(color(hsl.integer(317, 63, 11)), color(hsl.integer(0, 58, 41)), shot)
    const damask = mix(plum, color(hsl.integer(35, 55, 56)), flower.mul(0.24).mul(shot.add(0.2)))
    const bullion = mix(color(hsl.integer(59, 77, 49)), color(hsl.integer(83, 67, 86)), nap.mul(0.7).add(stitch.mul(0.3)))
    this.colorNode = mix(damask.mul(fiber.mul(threadDetail.mul(0.2)).add(0.83)), bullion, gold)
    this.metalnessNode = gold.mul(0.5).add(0.22)
    this.roughnessNode = float(0.4).sub(gold.mul(0.13)).sub(nap.mul(0.07))
    this.anisotropyNode = vec2(0.82, 0.08)
    this.sheenNode = mix(color(hsl.integer(346, 59, 48)), color(hsl.integer(72, 79, 84)), gold).mul(near.mul(0.18).add(0.36))
    this.sheenRoughness = 0.34
    this.clearcoat = 0.16
    this.clearcoatRoughness = 0.32
    this.iridescenceNode = gold.oneMinus().mul(grazing).mul(0.22)
    this.iridescenceThicknessNode = flower.mul(100).add(310)
    const pile = fiber.mul(threadDetail).mul(0.00032).add(gold.mul(0.00048))
      .add(mx_noise_float(p.mul(280)).mul(intimate).mul(0.000025))
    this.normalNode = proceduralNormal(pile, 1)
    this.emissiveNode = bullion.mul(gold).mul(nap).mul(breath).mul(near).mul(0.026)
  }
}
