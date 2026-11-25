import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionGeometry, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    // Integer repeats close both UV seams. Measure the footprint before fract, not across its jumps.
    const sheet = uv().mul(vec2(18, 4))
    const local = sheet.fract().sub(0.5)
    const footprint = sheet.fwidth().length().max(0.0001)
    const disc = (center: Node<'vec2'>, radius: number) => local.sub(center).length().sub(radius).smoothstep(footprint.negate(), footprint).oneMinus()
    const cyan = disc(vec2(-0.12, 0.06), 0.32)
    const vermilion = disc(vec2(0.12, 0.04), 0.32)
    const yellow = disc(vec2(0.015, -0.14), 0.3)
    // Dots converge to their area coverage when subpixel instead of sparkling at a distance.
    const screen = sheet.mul(9)
    const dotDistance = screen.fract().sub(0.5).length()
    const dotFootprint = screen.fwidth().length().max(0.0001)
    const dots = dotDistance.smoothstep(float(0.38).sub(dotFootprint), float(0.38).add(dotFootprint)).oneMinus()
    const halftone = mix(float(Math.PI * 0.38 ** 2), dots, dotFootprint.smoothstep(0.3, 0.9).oneMinus())
    const grain = mx_noise_float(positionGeometry.mul(170)).mul(0.5).add(0.5)
    const fiberVisibility = positionGeometry.mul(170).fwidth().length().smoothstep(0.4, 1.8).oneMinus()
    const paper = color(hsl.integer(87, 58, 91.7)).mul(grain.sub(0.5).mul(fiberVisibility).mul(0.09).add(1))
    const density = halftone.mul(0.36).add(0.64)
    const ink = (tint: number, mask: Node<'float'>) => mix(vec3(1), color(tint), mask.mul(density))
    const printed = paper.mul(ink(hsl.integer(216, 91, 58), cyan)).mul(ink(hsl.integer(27, 85, 61), vermilion)).mul(ink(hsl.integer(91, 90, 81), yellow))
    // Small registration crosses sit in the unprinted margins, not over the color rosettes.
    const crossPoint = local.abs().sub(vec2(0.4, 0.4)).abs()
    const crossField = crossPoint.x.sub(0.012).max(crossPoint.y.sub(0.055)).min(crossPoint.y.sub(0.012).max(crossPoint.x.sub(0.055)))
    const cross = crossField.smoothstep(footprint.negate(), footprint).oneMinus().mul(footprint.smoothstep(0.015, 0.09).oneMinus())
    this.colorNode = mix(printed, color(hsl.integer(244, 29, 24)), cross.mul(0.85))
    this.roughnessNode = float(0.88).sub(cyan.max(vermilion).max(yellow).mul(0.13))
    this.metalness = 0
    this.specularIntensity = 0.24
    this.sheen = 0.15
    this.sheenColor.set(hsl.integer(86, 41, 85))
    this.sheenRoughness = 0.9
    this.normalNode = proceduralNormal(grain.mul(fiberVisibility), 0.00018)
  }
}
