import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

type Point = readonly [number, number]
type Star = readonly [Point, Point]

// The same little star chart has two readings: a watching, seated familiar and a
// cat in flight. Every segment actually ends at a star, including the whiskers.
const stars: ReadonlyArray<Star> = [
  [[0.32, 0.6], [0.66, 0.63]], // 0 left cheek
  [[0.3, 0.76], [0.73, 0.78]], // 1 ear root
  [[0.35, 0.94], [0.83, 0.91]], // 2 ear tip
  [[0.45, 0.82], [0.78, 0.77]], // 3 forehead left
  [[0.55, 0.82], [0.9, 0.75]], // 4 forehead right
  [[0.66, 0.94], [0.97, 0.88]], // 5 ear tip
  [[0.71, 0.75], [0.95, 0.7]], // 6 ear root
  [[0.68, 0.59], [0.91, 0.61]], // 7 right cheek
  [[0.5, 0.51], [0.8, 0.56]], // 8 chin
  [[0.42, 0.69], [0.76, 0.69]], // 9 eye left
  [[0.59, 0.69], [0.89, 0.66]], // 10 eye right
  [[0.5, 0.61], [0.83, 0.63]], // 11 nose
  [[0.3, 0.43], [0.57, 0.46]], // 12 left shoulder
  [[0.26, 0.19], [0.47, 0.34]], // 13 left hip
  [[0.37, 0.12], [0.14, 0.35]], // 14 left paw
  [[0.44, 0.32], [0.52, 0.27]], // 15 front left knee
  [[0.44, 0.12], [0.32, 0.19]], // 16 front left paw
  [[0.59, 0.32], [0.69, 0.29]], // 17 front right knee
  [[0.59, 0.12], [0.83, 0.24]], // 18 front right paw
  [[0.73, 0.17], [0.82, 0.41]], // 19 right hip
  [[0.78, 0.12], [0.95, 0.43]], // 20 right paw
  [[0.84, 0.26], [0.35, 0.53]], // 21 tail base
  [[0.91, 0.4], [0.17, 0.64]], // 22 tail bend
  [[0.85, 0.52], [0.11, 0.78]], // 23 tail tip
  [[0.16, 0.7], [0.62, 0.69]], // 24 left whisker tip
  [[0.12, 0.55], [0.62, 0.58]], // 25 left whisker tip
  [[0.85, 0.7], [0.99, 0.67]], // 26 right whisker tip
  [[0.89, 0.55], [0.99, 0.54]], // 27 right whisker tip
]
const outline: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 0],
  [0, 12],
  [12, 13],
  [13, 14],
  [14, 16],
  [16, 15],
  [15, 12],
  [7, 17],
  [17, 18],
  [18, 20],
  [20, 19],
  [19, 7],
  [19, 21],
  [21, 22],
  [22, 23],
  [0, 24],
  [0, 25],
  [7, 26],
  [7, 27],
  [11, 8],
]
/** Anti-aliased distance to a finite line, plus its arc coordinate. */
function stitch(p: Node<'vec2'>, a: Node<'vec2'>, b: Node<'vec2'>, footprint: Node<'float'>) {
  const delta = b.sub(a)
  const along = p.sub(a).dot(delta).div(delta.dot(delta).max(0.00001)).clamp()
  const distance = p.sub(a.add(delta.mul(along))).length()
  return {
    along,
    length: delta.length(),
    coverage: distance.smoothstep(0.0035, footprint.mul(1.2).add(0.0035)).oneMinus(),
  }
}
function spark(p: Node<'vec2'>, center: Node<'vec2'>, footprint: Node<'float'>, radius: Node<'float'>) {
  const offset = p.sub(center)
  const distance = offset.length()
  const core = distance.smoothstep(radius.mul(0.18), radius.add(footprint)).oneMinus()
  const halo = distance.smoothstep(radius.mul(0.8), radius.mul(4.5).add(footprint)).oneMinus()
  // Anisotropic diffraction: the fine four-point flare resolves only up close.
  const cross = offset.x.abs().min(offset.y.abs())
  const ray = cross.smoothstep(0.002, footprint.mul(0.9).add(0.002)).oneMinus()
    .mul(distance.smoothstep(radius.mul(0.45), radius.mul(3.8)).oneMinus())
  return {
    core,
    halo,
    ray,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.26)
    this.name = knotData.id
    // UVs follow the knot's actual tube. Integer winding makes the images and
    // their identities meet exactly across both of the parameterization seams.
    const coordinate = uv().mul(vec2(10, 2))
    const cell = coordinate.floor()
    const p = coordinate.fract()
    const random = cellNoiseVec3(vec3(cell, 13.7))
    const leaping = random.x.smoothstep(0.37, 0.63)
    const flipped = random.y.smoothstep(0.43, 0.57)
    const mirror = mix(p.x, p.x.oneMinus(), flipped)
    const q = vec2(mirror.sub(0.5).mul(1.2).add(0.5), p.y)
    const footprint = coordinate.fwidth().mul(vec2(1.2, 1)).length().max(0.0001)
    const detail = footprint.smoothstep(0.035, 0.17).oneMinus()
    const near = positionView.length().smoothstep(1.3, 4.6).oneMinus()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const life = time.mul(0.43).add(random.z.mul(7))
    const blink = time.mul(0.84).add(random.y.mul(11)).sin().smoothstep(0.985, 0.997)
    const points = stars.map(([sitting, flying], index) => {
      const flight = vec2(flying[0] * 0.88 + 0.05, flying[1])
      const point = mix(vec2(...sitting), flight, leaping)
      // Each animal has a different breath, never a crawling UV texture.
      const breath = life.add(index * 1.27).sin().mul(index < 9 ? 0.002 : 0.003)
      return point.add(vec2(breath.mul(0.7), breath))
    })
    let filament: Node<'float'> = float(0)
    let procession: Node<'float'> = float(0)
    let stardust: Node<'float'> = float(0)
    let whiskers: Node<'float'> = float(0)
    for (const [start, end] of outline) {
      const {coverage, along, length: span} = stitch(q, points[start], points[end], footprint)
      const resolved = coverage.mul(detail.mul(0.83).add(0.17))
      filament = filament.max(resolved)
      const beadPhase = along.mul(span.mul(29).floor().max(1))
      const bead = beadPhase.fract().sub(0.5).abs().smoothstep(0.075, beadPhase.fwidth().add(0.075)).oneMinus()
      stardust = stardust.max(resolved.mul(bead))
      if (end >= 24) {
        whiskers = whiskers.max(resolved)
      }
      // A slow signal passes from star to star; every cat has its own heartbeat.
      const traveling = life.mul(1.8).sub(along.mul(5)).add(start * 0.76).sin().smoothstep(0.83, 0.99)
      procession = procession.max(resolved.mul(traveling))
    }
    let starCore: Node<'float'> = float(0)
    let starHalo: Node<'float'> = float(0)
    let starRay: Node<'float'> = float(0)
    for (const [i, point] of points.entries()) {
      const eye = i === 9 || i === 10
      const rare = [2, 5, 11, 23].includes(i)
      const twinkle = life.mul(2).add(i * 2.41).sin().mul(0.23).add(0.78)
      const ordinaryRadius = rare ? 0.019 : 0.012
      const radius = float(eye ? 0.016 : ordinaryRadius).mul(twinkle)
      const {core, halo, ray} = spark(q, point, footprint, radius)
      const eyelid = eye ? blink.mul(0.95).oneMinus() : float(1)
      starCore = starCore.max(core.mul(eyelid))
      starHalo = starHalo.max(halo.mul(eyelid).mul(rare ? 1 : 0.55))
      starRay = starRay.max(ray.mul(eyelid).mul(rare ? 1 : 0.4))
    }
    // Pale, elliptical eyes move independently of the fixed star map.
    // The iris turns toward the witness, then briefly shuts.
    const look = positionViewDirection.xy.mul(0.007)
    let irises: Node<'float'> = float(0)
    let eyeRims: Node<'float'> = float(0)
    for (const eye of [9, 10]) {
      const {core, halo} = spark(q, points[eye].add(look), footprint, float(0.008))
      starCore = starCore.max(core.mul(blink.oneMinus()))
      starHalo = starHalo.max(halo.mul(0.36).mul(blink.oneMinus()))
      const eyePosition = points[eye]
      const relative = q.sub(eyePosition)
      const ellipse = vec2(relative.x.div(0.027), relative.y.div(0.012)).length()
      const rim = ellipse.smoothstep(0.65, footprint.mul(38).add(0.65)).oneMinus().mul(blink.oneMinus())
      const pupil = relative.sub(look).x.abs().smoothstep(0.0035, footprint.mul(1.5).add(0.0035)).oneMinus()
      eyeRims = eyeRims.max(rim)
      irises = irises.max(rim.mul(pupil).mul(core.mul(0.4).add(0.6)))
    }
    // Pinpricks of dust in the great dark gaps between the larger stars.
    const micro = coordinate.mul(vec2(3, 4))
    const grit = cellNoiseVec3(vec3(micro.floor(), 94))
    const mote = micro.fract().sub(grit.xy.mul(0.5).add(0.25)).length()
    const moteSize = micro.fwidth().length().mul(0.5).add(0.04)
    const motes = mote.smoothstep(moteSize.mul(0.25), moteSize).oneMinus()
      .mul(grit.z.smoothstep(0.72, 0.85))
      .mul(micro.fwidth().length().smoothstep(0.55, 1.4).oneMinus())
    const fabric = mx_noise_float(positionGeometry.mul(8)).mul(0.5).add(0.5)
    const nebula = mx_noise_float(positionGeometry.mul(3.2).add(vec3(2, 0, 8))).mul(0.5).add(0.5)
    const woven = fabric.mul(0.25).add(nebula.mul(0.45)).add(grazing.mul(0.12))
    const midnight = mix(color(hsl.integer(267, 88, 3.5)), color(hsl.integer(264, 72, 18)), woven)
    const violet = nebula.smoothstep(0.48, 0.77).mul(0.42)
    const background = mix(midnight, color(hsl.integer(296, 60, 22)), violet)
    const indigo = mix(color(hsl.integer(260, 82, 38.5)), color(hsl.integer(312, 55, 60)), random.y)
    const pearl = mix(color(hsl.integer(205, 100, 90.4)), color(hsl.integer(71, 100, 88.3)), random.z)
    const pulse = life.mul(2.2).sin().mul(0.25).add(0.75)
    const eyes = starCore.mul(0.72).add(starRay.mul(near).mul(0.2))
    const glow = filament.mul(0.16).add(stardust.mul(0.35)).add(procession.mul(0.65)).add(starHalo.mul(0.22)).add(eyes.mul(1.9))
    this.colorNode = mix(background, indigo, filament.mul(0.22))
      .add(pearl.mul(starCore).mul(0.55))
      .add(color(hsl.integer(84, 61, 76)).mul(eyeRims).mul(0.23))
    this.emissiveNode = indigo.mul(filament.mul(0.2).add(stardust.mul(0.4)))
      .add(color(hsl.integer(205, 81, 79)).mul(procession).mul(0.5))
      .add(pearl.mul(glow).mul(pulse.mul(0.3).add(0.7)))
      .add(color(hsl.integer(222, 100, 90)).mul(starRay).mul(near).mul(0.27))
      .add(color(hsl.integer(85, 100, 86.8)).mul(eyeRims.mul(0.45).add(irises.mul(0.9))).mul(near.mul(0.5).add(0.5)))
      .add(color(hsl.integer(194, 80, 86)).mul(whiskers).mul(near.mul(0.15).add(0.06)))
      .add(color(hsl.integer(287, 100, 74)).mul(motes).mul(near.mul(0.09).add(0.02)))
    this.metalness = 0.13
    this.roughnessNode = float(0.77).sub(filament.mul(0.31)).sub(starCore.mul(0.2))
    this.clearcoat = 0.23
    this.clearcoatRoughness = 0.36
    this.normalNode = proceduralNormal(fabric.mul(0.003).add(filament.mul(0.001)), 0.4)
  }
}
