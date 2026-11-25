import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, bitangentView, color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

/** A hand-placed, connected star drawing; the drawing is constructed on the GPU, not baked into a texture. */
const stars = [
  [0.29, 0.91],
  [0.27, 0.76],
  [0.39, 0.79],
  [0.49, 0.82],
  [0.66, 0.93],
  [0.69, 0.75],
  [0.3, 0.7],
  [0.4, 0.71],
  [0.5, 0.65],
  [0.59, 0.71],
  [0.69, 0.66],
  [0.49, 0.57],
  [0.32, 0.63],
  [0.34, 0.51],
  [0.65, 0.52],
  [0.5, 0.44],
  [0.28, 0.36],
  [0.68, 0.4],
  [0.29, 0.22],
  [0.65, 0.24],
  [0.37, 0.13],
  [0.6, 0.13],
  [0.51, 0.19],
  [0.7, 0.26],
  [0.82, 0.18],
  [0.87, 0.25],
  [0.84, 0.38],
  [0.76, 0.43],
  [0.5, 0.52],
  [0.16, 0.7],
  [0.16, 0.6],
  [0.83, 0.7],
  [0.83, 0.6],
  [0.43, 0.64],
  [0.56, 0.64],
] as const
// The first paths form the contour. Whiskers and a tiny jeweled collar follow. The eyes are intentionally unconnected stars.
const outline = [
  [0, 1],
  [0, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [1, 6],
  [6, 12],
  [12, 11],
  [11, 10],
  [10, 5],
  [12, 13],
  [10, 14],
  [13, 16],
  [14, 17],
  [16, 18],
  [17, 19],
  [18, 20],
  [20, 22],
  [22, 21],
  [21, 19],
  [19, 23],
  [23, 24],
  [24, 25],
  [25, 26],
  [26, 27],
] as const
const details = [[8, 33], [8, 34], [33, 29], [33, 30], [34, 31], [34, 32], [11, 28]] as const
function pointSegmentDistance(p: Node<'vec2'>, a: Node<'vec2'>, b: Node<'vec2'>) {
  const v = b.sub(a)
  return p.sub(a).sub(v.mul(p.sub(a).dot(v).div(v.dot(v).max(0.00001)).clamp())).length()
}
/** Signed star discs, slender drawn connections and a few diffracting anchor stars. */
function constellation(p: Node<'vec2'>, phase: Node<'float'>) {
  const breath = time.mul(0.55).add(phase).sin().mul(0.005)
  const tail = time.mul(0.83).add(phase.mul(1.6)).sin().mul(0.023)
  const points: Array<Node<'vec2'>> = stars.map(([x, y], index) => {
    const head = index < 13 || index >= 29
    const tailPoint = index >= 24 && index <= 27
    return vec2(float(x).add(tailPoint ? tail.mul((index - 23) / 4) : 0), float(y).add(head ? breath : 0))
  })
  let contour: Node<'float'> = float(2)
  for (const [a, b] of outline) {
    contour = contour.min(pointSegmentDistance(p, points[a], points[b]))
  }
  let fine: Node<'float'> = float(2)
  for (const [a, b] of details) {
    fine = fine.min(pointSegmentDistance(p, points[a], points[b]))
  }
  let discs: Node<'float'> = float(2)
  let halo: Node<'float'> = float(2)
  for (const [i, point] of points.entries()) {
    const distance = p.sub(point).length()
    const radius = [0, 4, 7, 8, 9, 20, 21, 27, 28].includes(i) ? 0.019 : 0.011
    discs = discs.min(distance.sub(radius))
    halo = halo.min(distance)
  }
  let rays: Node<'float'> = float(0)
  for (const i of [0, 4, 8, 27, 28]) {
    const d = p.sub(points[i])
    const spread = d.length().smoothstep(0.012, 0.09).oneMinus().pow(2)
    const needle = d.x.abs().min(d.y.abs()).smoothstep(0.001, 0.004).oneMinus()
    rays = rays.max(needle.mul(spread))
  }
  return {
    contour,
    fine,
    discs,
    halo,
    rays,
  }
}

/** A living celestial atlas engraved in dark, polished lapis. Its cats are built from individual stars and the edges between them. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = data.id
    const fixedChart = uv().mul(vec2(7, 2))
    const view = positionViewDirection
    const aroundView = vec3(bitangentView as unknown as Node<'vec3'>)
    // Each pair of ghosts follows the observer around its tube cross-section. The metal astrolabe stays behind.
    const chart = vec2(fixedChart.x, float(0.5).sub(atan(view.dot(aroundView), view.dot(normalViewGeometry)).div(Math.PI)))
    const cell = chart.floor()
    const cellId = vec3(cell.x.mod(7), cell.y.mod(2).add(2).mod(2), 4)
    const identity = mx_cell_noise_float(cellId)
    const phase = cell.x.mul(1.97).add(cell.y.mul(3.7)).add(identity.mul(6.28))
    const facing = normalViewGeometry.dot(view).abs().clamp()
    const grazing = facing.oneMinus()
    const shift = vec2(view.dot(tangentView), view.dot(aroundView)).mul(grazing.mul(0.036))
    const side = cell.x.add(cell.y).mod(2).add(2).mod(2)
    const coords = chart.fract().add(shift)
    const local = vec2(mix(coords.x, coords.x.oneMinus(), side).sub(0.5).mul(2.2), coords.y.sub(0.5).mul(1.35))
    const upAxis = vec2(tangentView.y.mul(1.3), aroundView.y)
    const orientation = upAxis.length()
    const up = upAxis.div(orientation.max(0.001))
    const p = vec2(local.x.mul(up.y).sub(local.y.mul(up.x)), local.x.mul(up.x).add(local.y.mul(up.y))).add(0.5)
    const cat = constellation(p, phase)
    const footprint = p.fwidth().length().max(0.0003)
    const visible = footprint.smoothstep(0.08, 0.22).oneMinus().mul(orientation.smoothstep(0.08, 0.25))
    const line = cat.fine.smoothstep(0.003, footprint.mul(0.8).add(0.004)).oneMinus().mul(visible)
    const silhouette = cat.contour.smoothstep(0.006, footprint.mul(0.8).add(0.007)).oneMinus().mul(visible)
    const dot = cat.discs.smoothstep(footprint.mul(-0.7), footprint.mul(0.7)).oneMinus().mul(visible)
    const glow = cat.halo.smoothstep(0.008, 0.075).oneMinus().pow(2).mul(visible)
    const glint = cat.rays.mul(visible).mul(footprint.smoothstep(0.035, 0.12).oneMinus())
    const glimmer = time.mul(1.1).add(phase).add(positionGeometry.y.mul(5)).sin().mul(0.22).add(0.78)
    // GPU pow requires a nonnegative base; abs preserves this even-powered pulse.
    const chase = p.x.mul(17).add(p.y.mul(13)).sub(time.mul(1.4)).add(phase).sin().abs().pow(8).mul(0.65).add(0.35)
    // Fixed astrolabe engravings provide a frame of reference as the refracted constellations slide with the viewer.
    const staticCoords = fixedChart.fract().sub(vec2(0.5, 0.52))
    const radius = staticCoords.div(vec2(0.91, 1)).length()
    const ringAA = radius.fwidth().max(0.0005)
    const ring = radius.sub(0.477).abs().smoothstep(0.002, ringAA.mul(1.5).add(0.003)).oneMinus().mul(0.12)
    const innerRing = radius.sub(0.425).abs().smoothstep(0.001, ringAA.add(0.002)).oneMinus().mul(0.07)
    // Low-density background pinpricks, sampled in a periodic local chart, never obscure a cat’s face.
    const dustUV = fixedChart.mul(vec2(5, 7))
    const dustCell = dustUV.floor()
    const dustSeed = mx_cell_noise_float(vec3(dustCell.x.mod(35), dustCell.y.mod(14), 11.7))
    const dustPoint = dustUV.fract().sub(vec2(0.27, 0.63)).length()
    const dustAA = dustPoint.fwidth().max(0.001)
    const dust = dustPoint.smoothstep(0.03, dustAA.add(0.03)).oneMinus().mul(dustSeed.smoothstep(0.88, 0.96)).mul(dustAA.smoothstep(0.13, 0.4).oneMinus())
    const cloud = mx_noise_float(positionGeometry.mul(7.5)).mul(0.5).add(0.5)
    const nebula = mx_fractal_noise_float(positionGeometry.mul(4.5).add(vec3(time.mul(0.008), 0, 0)), 3, 2, 0.5).mul(0.5).add(0.5)
    const distance = positionView.length()
    const intimate = distance.smoothstep(1.1, 3.2).oneMinus()
    const hiddenDust = cellularPoints(positionGeometry.mul(24), 0.015, 0.105, 0.88).mul(intimate.pow(2))
    const cold = mix(color(hsl.integer(243, 44, 86)), color(hsl.integer(294, 64, 78)), identity)
    const warm = color(hsl.integer(72, 100, 88.3))
    const starlight = vec3(mix(cold, warm, identity.smoothstep(0.32, 0.84)))
    this.colorNode = vec3(mix(color(hsl.integer(269, 70, 4.7)), color(hsl.integer(268, 60, 17)), cloud.mul(0.42).add(grazing.mul(0.26))))
      .add(color(hsl.integer(287, 60, 19)).mul(nebula.smoothstep(0.57, 0.82)).mul(0.55))
      .add(color(hsl.integer(257, 18, 69)).mul(ring.add(innerRing)).mul(0.32))
      .add(starlight.mul(silhouette).mul(0.22))
    this.metalness = 0.18
    this.roughnessNode = float(0.47).sub(grazing.mul(0.13)).sub(dot.mul(0.06)).add(cloud.mul(0.06))
    this.clearcoat = 0.42
    this.clearcoatRoughness = 0.24
    this.iridescenceNode = grazing.pow(2).mul(0.38)
    this.iridescenceThicknessNode = cloud.mul(110).add(175)
    this.emissiveNode = starlight.mul(silhouette.mul(0.62).add(line.mul(0.37))).mul(chase.mul(0.35).add(0.65))
      .add(starlight.mul(dot).mul(glimmer).mul(1.85))
      .add(starlight.mul(glow).mul(intimate.mul(0.19).add(0.13)))
      .add(color(hsl.integer(82, 100, 97)).mul(glint).mul(0.7))
      .add(color(hsl.integer(255, 33, 76)).mul(ring.add(innerRing)).mul(0.13))
      .add(color(hsl.integer(236, 55, 73)).mul(dust).mul(intimate.mul(0.6).add(0.12)))
      .add(color(hsl.integer(311, 100, 86)).mul(hiddenDust).mul(0.5))
      .add(color(hsl.integer(283, 79, 36)).mul(nebula.smoothstep(0.67, 0.9)).mul(0.07))
      .add(color(hsl.integer(265, 67, 52)).mul(grazing.pow(3)).mul(0.15))
  }
}
