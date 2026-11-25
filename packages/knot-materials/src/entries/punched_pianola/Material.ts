import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionGeometry, uv, vec2} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const score = uv().mul(vec2(64, 8))
    const cell = score.floor().mod(vec2(64, 8))
    const local = score.fract().sub(0.5)
    const footprint = score.fwidth().length().max(0.0001)
    // A deterministic mechanical score, periodic at both ends of the roll.
    const code = cell.dot(vec2(127.1, 311.7)).sin().mul(43_758.5453).fract()
    const active = code.smoothstep(0.42, 0.43)
    const halfLength = code.mul(0.2).add(0.13)
    const delta = local.abs().sub(vec2(halfLength, 0.21))
    const slotDistance = delta.max(0).length().add(delta.x.max(delta.y).min(0)).sub(0.045)
    // Fade tiny holes closed before they become subpixel. The opaque rails stay intact.
    const resolved = footprint.smoothstep(0.16, 0.6).oneMinus()
    const hole = slotDistance.smoothstep(footprint.mul(-0.5), footprint.mul(0.5)).oneMinus().mul(active).mul(resolved)
    const rim = slotDistance.abs().smoothstep(0.025, footprint.add(0.065)).oneMinus().mul(active).mul(resolved)
    const roll = positionGeometry.mul(38)
    const patina = mx_noise_float(roll).mul(0.5).add(0.5)
    const brass = mix(color(hsl.integer(69, 63, 42)), color(hsl.integer(85, 57, 71)), patina.mul(0.52).add(0.24))
    // Long brushed lines run with the feed direction, but average out below pixel resolution.
    const brushPhase = uv().y.mul(Math.PI * 2 * 640)
    const brushing = brushPhase.sin().mul(brushPhase.fwidth().smoothstep(0.6, 3).oneMinus())
    this.colorNode = mix(brass, color(hsl.integer(91, 73, 89)), rim.mul(0.7))
    this.metalness = 0.88
    this.roughnessNode = float(0.34).sub(rim.mul(0.18)).add(brushing.mul(0.035))
    this.normalNode = proceduralNormal(rim.mul(0.0003).add(brushing.mul(0.000035)), 1)
    this.opacityNode = hole.oneMinus()
    this.alphaTest = 0.5
    this.alphaToCoverage = true
    this.side = DoubleSide
    this.clearcoat = 0.18
    this.clearcoatRoughness = 0.25
  }
}
