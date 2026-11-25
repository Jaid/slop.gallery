import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec2} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Screen-space-safe distance to a finite 2D line segment. */
function segmentDistance(point: Node<'vec2'>, start: Node<'vec2'>, end: Node<'vec2'>) {
  const delta = end.sub(start)
  const along = point.sub(start).dot(delta).div(delta.dot(delta).max(1e-8)).clamp(0, 1)
  return point.sub(start.add(delta.mul(along))).length()
}
/** A derivative-aware luminous filament with a restrained bright core. */
function luminousSegment(point: Node<'vec2'>, start: Node<'vec2'>, end: Node<'vec2'>, width: Node<'float'> | number, opacity: Node<'float'> | number = 1) {
  const halfWidth = typeof width === 'number' ? float(width) : width
  const strength = typeof opacity === 'number' ? float(opacity) : opacity
  const distance = segmentDistance(point, start, end)
  const footprint = distance.fwidth().max(0.00001)
  const core = distance.smoothstep(halfWidth, footprint.mul(0.8).add(halfWidth)).oneMinus()
  return core.mul(strength)
}
/** A hand-drawn occult cat: ears, almond eyes, whiskers, arched back and a curling tail. */
function catConstellation(point: Node<'vec2'>, footprint: Node<'float'>) {
  const head = vec2(0.025, 0.13)
  const earLeft = vec2(-0.16, 0.19)
  const earRight = vec2(0.18, 0.19)
  const body = vec2(0.015, -0.13)
  const line = (a: Node<'vec2'>, b: Node<'vec2'>, width: number) => luminousSegment(point, a, b, width)
  const dot = (center: Node<'vec2'>, radius: number) => {
    const distanceFromDot = point.sub(center).length()
    const dotFootprint = distanceFromDot.fwidth().max(0.00001)
    return distanceFromDot.smoothstep(radius, dotFootprint.mul(0.7).add(radius)).oneMinus()
  }
  const headLines = line(head, earLeft, 0.007).add(line(head, earRight, 0.007)).add(line(earLeft, vec2(-0.145, 0.31), 0.007)).add(line(earRight, vec2(0.17, 0.31), 0.007)).add(line(earLeft, vec2(0.15, 0.23), 0.007)).add(line(earRight, vec2(-0.15, 0.23), 0.007))
  const face = line(vec2(-0.105, 0.15), vec2(-0.035, 0.175), 0.006).add(line(vec2(-0.035, 0.175), vec2(0.005, 0.145), 0.006)).add(line(vec2(0.045, 0.145), vec2(0.105, 0.16), 0.006)).add(line(vec2(0.105, 0.16), vec2(0.14, 0.15), 0.006)).add(line(vec2(-0.09, 0.105), vec2(-0.19, 0.075), 0.005)).add(line(vec2(-0.1, 0.09), vec2(-0.2, 0.045), 0.005)).add(line(vec2(0.11, 0.105), vec2(0.19, 0.075), 0.005)).add(line(vec2(0.11, 0.09), vec2(0.2, 0.045), 0.005)).add(line(vec2(-0.015, 0.125), vec2(0.015, 0.125), 0.005)).add(line(vec2(0, -0.01), vec2(0, 0.075), 0.005))
  const bodyLines = line(body, vec2(-0.13, -0.06), 0.007).add(line(vec2(-0.13, -0.06), vec2(-0.17, -0.22), 0.007)).add(line(body, vec2(0.14, -0.04), 0.007)).add(line(vec2(0.14, -0.04), vec2(0.18, -0.2), 0.007)).add(line(vec2(-0.17, -0.22), vec2(-0.14, -0.36), 0.007)).add(line(vec2(0.18, -0.2), vec2(0.16, -0.36), 0.007)).add(line(vec2(-0.14, -0.36), vec2(0.16, -0.36), 0.007))
  const tail = line(vec2(0.15, -0.33), vec2(0.32, -0.3), 0.007).add(line(vec2(0.32, -0.3), vec2(0.36, -0.1), 0.007)).add(line(vec2(0.36, -0.1), vec2(0.28, 0.015), 0.007)).add(line(vec2(0.28, 0.015), vec2(0.24, -0.035), 0.007))
  const legs = line(vec2(-0.12, -0.35), vec2(-0.1, -0.42), 0.006).add(line(vec2(0.12, -0.35), vec2(0.14, -0.42), 0.006))
  const headDots = dot(head, 0.025).max(dot(earLeft, 0.026)).max(dot(earRight, 0.026)).max(dot(vec2(-0.145, 0.31), 0.02)).max(dot(vec2(0.17, 0.31), 0.02)).max(dot(vec2(-0.145, 0.23), 0.018)).max(dot(vec2(0.15, 0.23), 0.018)).max(dot(vec2(-0.105, 0.15), 0.016)).max(dot(vec2(0.14, 0.15), 0.016)).max(dot(vec2(0, 0.125), 0.019))
  const bodyDots = dot(body, 0.026).max(dot(vec2(-0.13, -0.06), 0.02)).max(dot(vec2(0.14, -0.04), 0.02)).max(dot(vec2(-0.17, -0.22), 0.021)).max(dot(vec2(0.18, -0.2), 0.021)).max(dot(vec2(-0.14, -0.36), 0.021)).max(dot(vec2(0.16, -0.36), 0.021)).max(dot(vec2(-0.12, -0.35), 0.017)).max(dot(vec2(0.12, -0.35), 0.017))
  const tailDots = dot(vec2(0.32, -0.3), 0.022).max(dot(vec2(0.36, -0.1), 0.022)).max(dot(vec2(0.28, 0.015), 0.02)).max(dot(vec2(0.24, -0.035), 0.018))
  const sparks = vec2(point.x.mul(71.3).fract().sub(0.5), point.y.mul(83.7).fract().sub(0.5)).length().smoothstep(0.04, 0.12).oneMinus()
  const resolved = footprint.smoothstep(0.1, 0.45).oneMinus()
  const lineMask = headLines.add(face).add(bodyLines).add(tail).add(legs).mul(resolved)
  return {
    dots: headDots.max(bodyDots).max(tailDots),
    eye: dot(vec2(-0.08, 0.158), 0.035).add(dot(vec2(0.065, 0.158), 0.035)),
    lineMask,
    stars: sparks.mul(resolved),
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const tube = uv()
    const {facing, grazing, near, intimate} = viewerFrame()
    const layout = tube.mul(vec2(7, 2))
    const cell = layout.floor()
    const local = layout.fract().sub(0.5)
    const cat = catConstellation(local, layout.fwidth().length())
    const catGate = cell.x.add(cell.y.mul(7)).sin().mul(43_758.5453).fract().smoothstep(0.12, 0.2)
    const catMask = cat.lineMask.mul(catGate)
    const dust = vec2(tube.x.mul(113).fract().sub(0.5), tube.y.mul(127).fract().sub(0.5)).length().smoothstep(0.018, 0.12).oneMinus()
    const dustGate = vec2(cell.x.mul(19.1), cell.y.mul(7.3)).sin().mul(9127.13).fract().smoothstep(0.73, 0.88)
    const pulse = time.mul(1.7).add(cell.x.mul(2.3)).add(cell.y.mul(4.1)).sin().mul(0.5).add(0.5)
    const hue = facing.mul(0.42).add(pulse.mul(0.08)).add(grazing.mul(0.12))
    const thread = mix(color(hsl.integer(274, 73, 11.4)), color(hsl.integer(295, 69, 21)), tube.y.mul(3).add(tube.x.mul(2)).sin().mul(0.5).add(0.5))
    const catColor = cosinePalette(hue, [0.38, 0.52, 0.8], [0.48, 0.4, 0.32], [1, 1, 1], [0.02, 0.28, 0.58])
    this.colorNode = mix(thread, catColor.mul(0.8), catMask.mul(0.62)).add(color(hsl.integer(283, 74, 11)).mul(cat.eye).mul(0.25))
    this.metalness = 0.35
    this.roughnessNode = float(0.19).add(catMask.mul(0.08)).add(grazing.mul(0.08))
    this.clearcoat = 0.65
    this.clearcoatRoughnessNode = float(0.12).add(grazing.mul(0.1))
    this.iridescence = 0.35
    this.iridescenceThicknessNode = facing.mul(280).add(180)
    this.normalNode = proceduralNormal(catMask.mul(0.004).add(cat.dots.mul(0.006)).add(cat.eye.mul(0.009)), 0.004)
    this.emissiveNode = catColor.mul(catMask.mul(0.72).add(cat.dots.mul(2.35)).add(cat.stars.mul(0.18)).add(cat.eye.mul(1.3))).mul(near.mul(0.45).add(0.55)).add(color(hsl.integer(92, 100, 96.2)).mul(cat.eye).mul(pulse.mul(0.35).add(0.65)).mul(near)).add(color(hsl.integer(275, 100, 63)).mul(dust.mul(dustGate).mul(0.9).mul(intimate.mul(0.55).add(0.25)) as unknown as Node<'float'>))
  }
}
