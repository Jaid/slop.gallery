import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const disk = (radius: Node<'float'>, size: Node<'float'> | number, footprint: Node<'float'>) => {
  const extent = typeof size === 'number' ? float(size) : size
  return radius.smoothstep(extent.sub(footprint), extent.add(footprint)).oneMinus()
}
const segment = (point: Node<'vec2'>, a: readonly [number, number], b: readonly [number, number]) => {
  const pa = point.sub(vec2(...a))
  const ba = vec2(...b).sub(vec2(...a))
  const h = pa.dot(ba).div(ba.dot(ba)).clamp(0, 1)
  return pa.sub(ba.mul(h)).length()
}
const link = (point: Node<'vec2'>, a: readonly [number, number], b: readonly [number, number], width: number, footprint: Node<'float'>) => segment(point, a, b).smoothstep(float(width), float(width).add(footprint)).oneMinus()
const glowDot = (point: Node<'vec2'>, centre: readonly [number, number], radius: number, footprint: Node<'float'>) => disk(point.sub(vec2(...centre)).length(), radius, footprint)
const catPoint = (local: Node<'vec2'>, footprint: Node<'float'>) => {
  const body = disk(local.sub(vec2(-0.015, -0.13)).length(), 0.24, footprint.mul(1.4))
  const chest = disk(local.sub(vec2(0.105, -0.015)).length(), 0.165, footprint.mul(1.4))
  const head = disk(local.sub(vec2(0.12, 0.21)).length(), 0.14, footprint.mul(1.4))
  const leftEar = local.sub(vec2(0.035, 0.29)).mul(vec2(1, 1.8)).length().smoothstep(0.07, footprint.add(0.07))
  const rightEar = local.sub(vec2(0.205, 0.29)).mul(vec2(1, 1.8)).length().smoothstep(0.07, footprint.add(0.07))
  const silhouette = body.max(chest).max(head).max(leftEar).max(rightEar)
  let network = link(local, [0.04, 0.28], [0.1, 0.34], 0.009, footprint.mul(0.7))
    .max(link(local, [0.1, 0.34], [0.18, 0.28], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.04, 0.28], [0.08, 0.2], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.18, 0.28], [0.16, 0.2], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.08, 0.2], [0.16, 0.2], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.12, 0.34], [0.12, 0.22], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.06, 0.16], [-0.02, 0.04], 0.009, footprint.mul(0.7)))
    .max(link(local, [-0.02, 0.04], [-0.14, 0.02], 0.009, footprint.mul(0.7)))
    .max(link(local, [-0.14, 0.02], [-0.2, -0.14], 0.009, footprint.mul(0.7)))
    .max(link(local, [-0.2, -0.14], [-0.13, -0.26], 0.009, footprint.mul(0.7)))
    .max(link(local, [-0.13, -0.26], [-0.03, -0.24], 0.009, footprint.mul(0.7)))
    .max(link(local, [-0.03, -0.24], [0.08, -0.22], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.08, -0.22], [0.16, -0.25], 0.009, footprint.mul(0.7)))
    .max(link(local, [-0.15, 0], [0.11, -0.04], 0.009, footprint.mul(0.7)))
    .max(link(local, [-0.19, -0.08], [0.12, -0.1], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.16, -0.05], [0.19, -0.23], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.19, -0.23], [0.3, -0.22], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.3, -0.22], [0.37, -0.12], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.37, -0.12], [0.35, 0.02], 0.009, footprint.mul(0.7)))
    .max(link(local, [0.35, 0.02], [0.27, 0.09], 0.009, footprint.mul(0.7)))
  network = network.max(link(local, [0.08, 0.2], [-0.03, 0.15], 0.008, footprint.mul(0.7))).max(link(local, [0.16, 0.2], [0.3, 0.15], 0.008, footprint.mul(0.7))).max(link(local, [0.1, 0.16], [-0.02, 0.08], 0.008, footprint.mul(0.7)))
  const nodes = glowDot(local, [0.08, 0.2], 0.038, footprint.mul(0.8))
    .max(glowDot(local, [0.16, 0.2], 0.038, footprint.mul(0.8)))
    .max(glowDot(local, [0.12, 0.34], 0.034, footprint.mul(0.8)))
    .max(glowDot(local, [-0.02, 0.04], 0.038, footprint.mul(0.8)))
    .max(glowDot(local, [-0.14, 0.02], 0.036, footprint.mul(0.8)))
    .max(glowDot(local, [-0.2, -0.14], 0.036, footprint.mul(0.8)))
    .max(glowDot(local, [-0.03, -0.24], 0.036, footprint.mul(0.8)))
    .max(glowDot(local, [0.16, -0.25], 0.036, footprint.mul(0.8)))
    .max(glowDot(local, [0.3, -0.22], 0.036, footprint.mul(0.8)))
    .max(glowDot(local, [0.35, 0.02], 0.036, footprint.mul(0.8)))
  const eye = glowDot(local, [0.12, 0.225], 0.018, footprint.mul(0.65))
  const dotScale = local.mul(17)
  const dotCell = dotScale.floor()
  const jitter = vec2(dotCell.x.mul(12.9898).add(dotCell.y.mul(78.233)).sin().fract().sub(0.5), dotCell.x.mul(39.346).add(dotCell.y.mul(11.135)).sin().fract().sub(0.5)).mul(0.16)
  const dotDistance = dotScale.fract().sub(0.5).sub(jitter).length()
  const dotFootprint = dotScale.fwidth().length().max(0.001)
  const dots = disk(dotDistance, 0.12, dotFootprint.mul(0.8)).mul(silhouette.max(network.mul(1.8)))
  return {
    silhouette,
    network,
    nodes,
    eye,
    dots,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const modules = vec2(12, 2)
    const q = tube.mul(modules)
    const cell = q.floor()
    const local = q.fract().sub(0.5)
    const wrapped = vec2(cell.x.mod(modules.x).add(modules.x).mod(modules.x), cell.y.mod(modules.y).add(modules.y).mod(modules.y))
    const random = cellNoiseVec3(vec3(wrapped.x.add(0.5), wrapped.y.add(0.5), 11.7))
    const angle = random.x.sub(0.5).mul(0.18)
    const localRotated = vec2(local.x.mul(angle.cos()).sub(local.y.mul(angle.sin())), local.x.mul(angle.sin()).add(local.y.mul(angle.cos())))
    const footprint = local.fwidth().length().max(0.001)
    const cat = catPoint(localRotated, footprint)
    const phase = random.z.mul(TAU)
    const drift = time.mul(0.16).add(phase)
    const dustScale = local.mul(19)
    const dustCell = dustScale.floor()
    const dustRandom = cellNoiseVec3(vec3(dustCell.x, wrapped.y.mul(23), dustCell.y.add(31)))
    const dustCenter = dustRandom.mul(0.38).add(0.31)
    const dustDistance = dustScale.fract().sub(dustCenter).length()
    const dustFootprint = dustScale.fwidth().length().max(0.001)
    const dust = disk(dustDistance, 0.09, dustFootprint.mul(0.75)).mul(dustRandom.y.smoothstep(0.37, 0.5))
    const unresolved = dustFootprint.smoothstep(0.12, 0.38).oneMinus()
    const starPulse = drift.add(dustRandom.z.mul(TAU)).sin().mul(0.18).add(0.82)
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const nebula = mx_noise_float(p.mul(2.8).add(vec3(time.mul(0.008), 0, time.mul(-0.006)))).mul(0.5).add(0.5)
    const base = mix(color(hsl.integer(272, 50, 3)), color(hsl.integer(270, 58, 12)), nebula.pow(2))
    const catBody = mix(color(hsl.integer(257, 55, 19)), color(hsl.integer(311, 42, 27)), random.y).mul(cat.silhouette.mul(0.34).add(0.08))
    this.colorNode = mix(base, catBody, cat.silhouette)
    this.metalnessNode = cat.silhouette.mul(-0.28).add(0.28)
    this.roughnessNode = float(0.36).sub(cat.silhouette.mul(0.13)).sub(cat.eye.mul(0.2)).add(dust.mul(0.08))
    this.normalNode = proceduralNormal(cat.nodes.mul(0.0012).add(cat.dots.mul(0.00075)).add(dust.mul(0.00025)).add(cat.network.mul(0.00045)), 0.75)
    this.clearcoatRoughnessNode = float(0.2).sub(grazing.mul(0.09))
    this.iridescenceNode = cat.silhouette.mul(0.24).add(grazing.mul(0.1))
    this.iridescenceThicknessNode = facing.mul(240).add(180)
    const lineColor = mix(color(hsl.integer(217.6, 100, 82)), color(hsl.integer(67, 100, 80.7)), random.x)
    const breathe = drift.sin().mul(0.16).add(0.84)
    this.emissiveNode = lineColor.mul(cat.network.mul(0.7).add(cat.nodes.mul(1.6)).add(cat.dots.mul(1.25)).add(cat.eye.mul(3))).mul(breathe)
      .add(mix(color(hsl.integer(248, 100, 86)), color(hsl.integer(71, 100, 84.8)), dustRandom.z).mul(dust).mul(unresolved).mul(starPulse).mul(near.mul(0.7).add(0.3)))
      .add(color(hsl.integer(259, 64, 50)).mul(cat.silhouette).mul(grazing.pow(2)).mul(0.08))
      .add(color(hsl.integer(89, 59, 92)).mul(intimate.mul(0.025)))
  }
}
