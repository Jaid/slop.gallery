import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, tangentLocal, time, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const T = tangentLocal
const B = bitangentLocal as unknown as Node<'vec3'>
const pitch = 16
const spikeRadius = float(0.03)
type Site = {
  cone: Node<'float'>
  foot: Node<'float'>
  radius: Node<'float'>
  random: Node<'vec3'>
}
/** The Rosensweig lattice: one nucleation point of the instability, with its own habit and its own place in the array. The lattice is anchored in object space, so the hedgehog stays continuous all the way around the knot, and every cone is the same analytic shape everywhere. */
const site = (p: Node<'vec3'>): Site => {
  const lattice = p.mul(pitch).floor()
  const random = cellNoiseVec3(lattice.add(vec3(4.1, 2.7, 8.3)))
  const nucleus = lattice.add(0.5).add(random.sub(0.5).mul(0.44)).div(pitch)
  const delta = p.sub(nucleus)
  const radius = vec2(delta.dot(T), delta.dot(B)).length()
  return {
    cone: radius.smoothstep(spikeRadius, spikeRadius.mul(0.16)).pow(float(0.9).add(random.z.mul(0.9))),
    foot: radius.fwidth().max(1e-5),
    random,
    radius,
  }
}
/** Loadstone: a black iron fluid held in a magnetic field. Where the field wins, the surface climbs into a regular hedgehog of leaning cones; where it loses, the metal is a still black mirror. The field turns slowly and its pull travels through the iron as a swell, so the hedgehog leans, the glints travel, and the liquid reads as something deciding, moment by moment, how to stand up. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.35)
    this.name = knotData.id
    const {p, grazing, intimate, rim} = viewerFrame()
    const N = normalLocal.normalize()
    const spin = time.mul(0.14)
    const axis = vec3(spin.cos().mul(0.8), 0.35, spin.sin())
    const region = mx_fractal_noise_float(p.mul(2.4).add(vec3(5.3, 1.7, 9.1)), 3, 2.1, 0.55)
    const wave = p.dot(axis).sub(time.mul(0.28)).mul(2.4).sin().mul(0.16)
    const field = region.add(wave).smoothstep(-0.15, 0.42)
    const {cone, foot, radius} = site(p)
// A cone narrower than the pixel that covers it is a speckle, not a spike; let it dissolve instead
// of aliasing into glitter.
    const resolved = foot.smoothstep(spikeRadius.mul(0.45), spikeRadius.mul(1.25)).oneMinus()
    const height = cone.mul(resolved).mul(field)
    const ring = radius.sub(spikeRadius.mul(0.92)).abs().smoothstep(spikeRadius.mul(0.4), foot.mul(1.5).add(spikeRadius.mul(0.4))).oneMinus().mul(resolved).mul(field)
    const tip = radius.smoothstep(spikeRadius.mul(0.32), spikeRadius.mul(0.1)).mul(resolved).mul(field)
    const lean = axis.sub(N.mul(axis.dot(N)))
    const sheet = mx_fractal_noise_float(p.mul(9).add(vec3(2.7, 8.1, 3.3)), 3, 2.3, 0.5)
    const skin = mx_noise_float(p.mul(70).add(vec3(4.1, 0.7, 6.3)))
    const gloss = float(0.042).add(sheet.mul(0.022)).sub(intimate.mul(0.014)).clamp(0.015, 0.2)
    this.colorNode = mix(vec3(0.032, 0.035, 0.048), vec3(0.082, 0.086, 0.105), sheet.mul(0.5).add(0.5))
    this.metalness = 1
    this.roughnessNode = gloss.add(ring.mul(0.02)).add(skin.mul(0.012))
    this.iridescenceNode = float(0.3).mul(grazing.mul(0.8).add(0.2))
    this.iridescenceThicknessNode = sheet.mul(90).add(grazing.mul(200)).add(210)
// The vertex stage gets its own, screen-derivative-free copy of the same lattice: a footprint does
// not exist there, and asking for one would leave the whole pipeline uncompilable.
    const vertex = site(p)
    this.positionNode = positionGeometry
      .add(N.mul(vertex.cone.mul(field).mul(0.046)))
      .add(T.mul(lean.x.mul(vertex.cone.mul(field).mul(0.019))))
      .add(B.mul(lean.y.mul(vertex.cone.mul(field).mul(0.019))))
      .add(N.mul(field.mul(sheet.mul(0.4).add(0.6)).mul(0.0022)))
    const relief = ring.mul(0.0009).add(height.mul(0.0022)).add(sheet.mul(0.00012))
    const bump = proceduralNormal(relief, 1.1)
    this.normalNode = bump
    const glint = glints(bump, 220).mul(tip.mul(0.8).add(field.mul(0.25)))
    this.emissiveNode = color(hsl.integer(0, 0, 100)).mul(glint.mul(0.55))
      .add(color(hsl.integer(261, 71, 52)).mul(tip.mul(field).mul(0.16)))
      .add(color(hsl.integer(264, 52, 28)).mul(rim.pow(2.2).mul(0.22)))
      .add(color(hsl.integer(266, 56, 64)).mul(ring.mul(grazing).mul(0.05)))
  }
}
