import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, vec2, vec3} from 'three/tsl'

import {approach, wave} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A single carved block of figured wood, with growth rings continuous across the entire knot. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, grazing, objectDistance} = viewerFrame()
    const near = approach(objectDistance)
    const warp = mx_noise_float(p.mul(vec3(3.2, 1.8, 3.2)))
    const burl = vec2(p.x.add(warp.mul(0.18)), p.z.add(p.y.mul(3).sin().mul(0.13)))
    const radius = burl.length().max(0.001)
    const phase = radius.mul(103).add(warp.mul(8)).add(p.y.mul(2))
    const rings = wave(phase).mul(0.5).add(0.5)
    const latewood = rings.pow(5)
    const hair = wave(phase.mul(5).add(mx_noise_float(p.mul(40)).mul(0.45))).mul(0.5).add(0.5)
    const tissue = mx_noise_float(p.mul(vec3(160, 12, 160))).mul(0.5).add(0.5)
    const pores = tissue.smoothstep(0.68, 0.82).mul(near)
    const sap = mx_noise_float(p.mul(2.6).add(vec3(1, 5, 2))).smoothstep(-0.16, 0.43)
    const darkWood = mix(color(hsl.integer(12, 62, 11)), color(hsl.integer(36, 79, 37)), rings)
    const honey = mix(color(hsl.integer(54, 71, 49)), color(hsl.integer(81, 65, 79)), rings.mul(0.5).add(0.25))
    const wood = mix(darkWood, honey, sap).mul(latewood.mul(-0.32).add(1)).mul(hair.mul(0.055).add(0.945))
    // Alternating fiber tilt makes figured wood flash in broad ribbons when the observer moves.
    const grainTilt = vec3(phase.mul(0.24).sin().mul(0.65), 1, phase.mul(0.19).cos().mul(0.45)).normalize()
    const chatoyance = view.dot(grainTilt).abs().oneMinus().pow(6)
    const breath = time.mul(0.16).sin().mul(0.035).add(0.965)
    this.colorNode = mix(wood, color(hsl.integer(77, 73, 79)), chatoyance.mul(0.31).mul(breath)).mul(pores.mul(-0.38).add(1))
    this.metalness = 0
    this.roughnessNode = tissue.mul(0.08).add(0.29).add(pores.mul(0.17))
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.16
    this.anisotropy = 0.72
    this.anisotropyNode = vec2(phase.mul(0.15).cos(), phase.mul(0.15).sin()).mul(0.72)
    this.sheen = 0.35
    this.sheenNode = color(hsl.integer(59, 76, 59)).mul(chatoyance.mul(0.7).add(0.1))
    this.sheenRoughness = 0.4
    this.normalNode = proceduralNormal(latewood.mul(-0.00055).add(hair.mul(0.00009)).sub(pores.mul(0.00035)), 0.65)
    this.aoNode = pores.mul(-0.18).add(1)
    this.emissiveNode = color(hsl.integer(53, 81, 55.5)).mul(chatoyance).mul(grazing).mul(0.025)
  }
}
