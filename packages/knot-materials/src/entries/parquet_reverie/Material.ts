import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, uv, vec2} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** Alternating triangles of maple, rosewood and walnut, not a noise-colored timber surface. Integer repeats and wrapped cell identities close both seams of the knot's UV torus. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const q = uv().mul(vec2(24, 6))
    const cell = q.floor().mod(vec2(24, 6))
    const local = q.fract()
    const footprint = q.fwidth().length().max(0.0001)
    const diagonal = local.x.add(local.y).sub(1)
    const triangle = diagonal.smoothstep(footprint.negate(), footprint)
    const checker = cell.x.add(cell.y).mod(2)
    const grainAxis = mix(local.x.sub(local.y), local.x.add(local.y), triangle)
    const curl = local.y.mul(9).add(cell.x.mul(2.7)).sin().mul(0.7)
    const phase = grainAxis.mul(TAU * 12).add(curl).add(cell.y.mul(1.9))
    // Filter before shading: subpixel growth lines converge to their average instead of sparkling.
    const grainVisibility = footprint.mul(12).smoothstep(0.18, 0.65).oneMinus()
    const grain = phase.sin().mul(phase.mul(0.37).sin().mul(0.25).add(0.75)).mul(grainVisibility)
    const pale = mix(color(hsl.integer(82, 59, 77)), color(hsl.integer(66, 59, 61)), checker.mul(0.55))
    const dark = mix(color(hsl.integer(42, 64, 37)), color(hsl.integer(38, 36, 17)), checker)
    const wood = mix(pale, dark, triangle).mul(grain.mul(0.16).add(0.91))
    const edge = local.min(local.oneMinus())
    const jointDistance = edge.x.min(edge.y).min(diagonal.abs().mul(Math.SQRT1_2))
    const joint = jointDistance.smoothstep(0.009, footprint.add(0.009)).oneMinus()
    const border = jointDistance.smoothstep(0.032, footprint.add(0.032)).oneMinus()
    const inlay = border.sub(joint).clamp()
    this.colorNode = mix(mix(wood, color(hsl.integer(85, 60, 86)), inlay.mul(0.8)), color(hsl.integer(59, 21, 13)), joint)
    this.metalness = 0
    this.ior = 1.46
    this.specularIntensity = 0.65
    this.roughnessNode = float(0.37).add(joint.mul(0.25)).add(grain.mul(0.025))
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.27
    this.anisotropy = 0.35
    this.anisotropyNode = vec2(1, triangle.mul(2).sub(1)).normalize().mul(0.35)
    this.normalNode = proceduralNormal(grain.mul(0.00012).sub(joint.mul(0.0005)), 1)
  }
}
