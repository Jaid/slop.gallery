import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentGeometry, color, exp, Fn, mix, mx_fractal_noise_float, mx_noise_float, positionViewDirection, sin, tangentGeometry, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const bells = 22
const rows = 40
const columns = 12
/** A chain of pulsing jelly bells; the whole silhouette contracts in a slow swimming wave. */
const bellPosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const segment = tube.x.mul(bells).fract()
  const bell = sin(segment.mul(Math.PI)).pow(1.35)
  const edgeRim = exp(segment.min(segment.oneMinus()).mul(28).pow2().negate())
  const swim = sin(time.mul(1.08).sub(tube.x.mul(TAU * 2.5))).mul(0.5).add(0.5)
  const height = bell.mul(swim.mul(0.0075).add(0.0095)).add(edgeRim.mul(0.0028))
  return p.add(normal.mul(height))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = bellPosition(tube)
    const epsilon = 0.0004
    const du = bellPosition(tube.add(vec2(epsilon, 0))).sub(bellPosition(tube.sub(vec2(epsilon, 0))))
    const dv = bellPosition(tube.add(vec2(0, epsilon))).sub(bellPosition(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, view, grazing, near} = viewerFrame()
    const segment = tube.x.mul(bells).fract()
    const bell = sin(segment.mul(Math.PI)).pow(1.35)
    const edgeRim = exp(segment.min(segment.oneMinus()).mul(28).pow2().negate())
    const swim = sin(time.mul(1.08).sub(tube.x.mul(TAU * 2.5))).mul(0.5).add(0.5)
// Internal light lives below the skin, so the whole luminous anatomy slides with the viewing angle.
    const tangentView = view.dot(tangentGeometry)
    const bitangentView = view.dot(bitangentGeometry as unknown as Node<'vec3'>)
    const parallax = vec2(tangentView.div(7.177), bitangentView.div(0.8168)).mul(0.021)
    const tissue = mx_fractal_noise_float(p.mul(4).add(vec3(0, 0, time.mul(0.012))), 4, 2.02, 0.55).mul(0.5).add(0.5)
    const milk = mx_noise_float(p.mul(10.5).add(vec3(2.4, 8.2, 1.1))).mul(0.5).add(0.5)
    const skin = mix(mix(color(hsl.integer(261, 62, 3)), color(hsl.integer(256, 63, 9)), tissue.smoothstep(0.18, 0.8)), color(hsl.integer(265, 31, 69)), milk.mul(0.06))
    const flesh = mix(skin, color(hsl.integer(296, 71, 11)), milk.mul(0.16).mul(bell))
    const canalCoord = tube.y.mul(10).add(tube.x.mul(10)).add(parallax.y.mul(9))
    const canal = sin(canalCoord.mul(TAU)).max(0).pow(12)
    const canalPulse = sin(time.mul(1.2).sub(tube.x.mul(TAU * 3))).max(0).pow(4)
    const gutCoord = tube.y.sub(0.5).add(parallax.y.mul(1.7)).fract().sub(0.5).abs()
    const gut = gutCoord.smoothstep(0.012, 0.085).oneMinus()
    const gut2Coord = tube.y.sub(0.17).sub(parallax.y.mul(1.1)).fract().sub(0.5).abs()
    const gut2 = gut2Coord.smoothstep(0.008, 0.05).oneMinus()
// A helical lattice of photophores: one full turn per knot circuit keeps the seam exact.
    const lattice = vec2(tube.x.mul(rows), tube.y.mul(columns).add(tube.x.mul(columns))).add(parallax.mul(vec2(rows, columns)))
    const period = vec2(rows, columns)
    const cell = lattice.floor()
    const random = cellNoiseVec3(vec3(wrapCell(cell, period), 6.7))
    const centre = cell.add(random.xy.mul(0.5).add(0.25))
    const lampDistance = vec2(lattice.x.sub(centre.x).mul(7.177 / rows), lattice.y.sub(centre.y).mul(0.8168 / columns)).length()
    const detailFade = lampDistance.fwidth().smoothstep(0.008, 0.032).oneMinus()
    const lampSize = random.y.smoothstep(0.79, 0.94).mul(0.03).add(0.02)
    const core = lampDistance.smoothstep(lampSize.mul(0.42), lampSize).oneMinus().mul(detailFade)
    const halo = lampDistance.smoothstep(0, 0.13).oneMinus()
    const active = random.z.smoothstep(0.14, 0.3)
    const pulse = sin(time.mul(1.3).sub(tube.x.mul(TAU * 2)).add(random.z.mul(TAU))).max(0).pow(8)
    const wave = sin(time.mul(0.31).sub(tube.x.mul(TAU * 1.5))).max(0).pow(10)
    const energy = pulse.mul(0.55).add(0.45).mul(wave.mul(0.5).add(0.5)).mul(active).mul(1.25)
    const lampColor = mix(mix(color(hsl.integer(177, 100, 88.7)), color(hsl.integer(336, 99, 76)), random.x.smoothstep(0.3, 0.62)), color(hsl.integer(269, 99, 70)), random.y.smoothstep(0.55, 0.82))
    const warmAccent = random.y.smoothstep(0.86, 0.95)
    const lamp = mix(mix(lampColor, color(hsl.integer(68, 100, 86.6)), warmAccent.mul(0.7)), color(hsl.integer(0, 0, 100)), core.mul(0.3))
    const socket = exp(lampDistance.sub(lampSize.mul(1.7)).pow2().mul(-1400)).mul(active)
    const organCoord = vec2(tube.x.mul(7.177), tube.y.mul(0.8168)).add(parallax.mul(vec2(7.177, 0.8168)))
    const organDistance = organCoord.sub(vec2(1.35, 0.3)).length().min(organCoord.sub(vec2(4.9, 0.62)).length())
    const organ = organDistance.smoothstep(0.05, 0.2).oneMinus().mul(0.7)
    this.colorNode = mix(mix(flesh, mix(skin, color(hsl.integer(178, 38, 86)), canal.mul(0.35).add(gut.mul(0.2))), bell.mul(0.55)), color(hsl.integer(323, 52, 3)), socket.mul(0.6)).add(color(hsl.integer(9, 58, 22)).mul(organ.mul(0.2)))
    this.metalness = 0
    this.roughness = 0.14
    this.ior = 1.36
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.sheen = 0.35
    this.sheenNode = color(hsl.integer(271, 77, 46.5)).mul(0.42)
    this.sheenRoughness = 0.34
// The skin carries fine radial canals and the soft rim of every bell, but no hard shell.
    const rimHeight = edgeRim.mul(0.0009)
    const canalHeight = canal.mul(0.00045)
    const skinRipple = mx_noise_float(p.mul(34).add(vec3(1.1, 5.6, 3.2))).mul(near.mul(0.00028))
    const cilia = mx_noise_float(vec3(tube.y.mul(260), tube.x.mul(48), time.mul(0.7))).mul(near.mul(0.00018))
    const lampHeight = core.mul(0.00018)
    const detailHeight = rimHeight.add(canalHeight).add(skinRipple).add(cilia).add(lampHeight)
    const bump = bumpNormal(detailHeight, surfaceNormal, 1.15)
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const facing = surfaceNormal.dot(positionViewDirection).abs().clamp()
    const haloLight = halo.mul(energy).mul(0.3)
    const coreLight = core.mul(energy).mul(1.85)
    const gutLight = gut.mul(swim.mul(0.5).add(0.5)).mul(0.5)
    const canalLight = canal.mul(canalPulse.mul(0.35).add(0.08)).mul(0.16)
    const rimLight = edgeRim.mul(swim.mul(0.6).add(0.4)).mul(bell.mul(0.4).add(0.6)).mul(0.3)
    const bodyFlash = color(hsl.integer(181, 86, 81)).mul(wave.mul(0.05)).mul(bell)
    this.emissiveNode = lamp.mul(coreLight.add(haloLight))
      .add(color(hsl.integer(43, 99, 75)).mul(gutLight)).add(color(hsl.integer(13, 100, 70)).mul(organ.mul(0.16)))
      .add(color(hsl.integer(183, 77, 83)).mul(gut2.mul(0.12)))
      .add(color(hsl.integer(184, 75, 86)).mul(canalLight))
      .add(color(hsl.integer(180, 99, 94)).mul(rimLight))
      .add(bodyFlash)
      .add(color(hsl.integer(180, 91, 81)).mul(grazing.pow(3)).mul(0.24))
      .add(color(hsl.integer(352, 100, 70)).mul(grazing.pow(6)).mul(0.12))
      .add(color(hsl.integer(239, 37, 67)).mul(facing.pow(5)).mul(0.03))
  }
}
