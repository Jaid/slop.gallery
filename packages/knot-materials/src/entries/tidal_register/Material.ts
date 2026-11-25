import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, tangentGeometry, tangentView, time, uv, vec2} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** A slow traveling wave turns two-sided enamel discs inside machined bronze sockets. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const q = uv().mul(vec2(48, 8))
    const local = q.fract().sub(0.5)
    const identity = q.floor().add(0.5)
    const footprint = q.fwidth().length().max(0.0001)
    const resolved = footprint.smoothstep(0.35, 1.2).oneMinus()
    const radius = local.length()
    const circle = (distance: Node<'float'>, size: number) => distance.smoothstep(float(size).sub(footprint), float(size).add(footprint)).oneMinus()
    const socket = circle(radius, 0.46)
    const recess = circle(radius, 0.405)
    const bezel = socket.sub(recess).clamp()
    // Integer spatial windings keep the traveling tide periodic at the two UV seams.
    const wave = identity.x.mul(TAU * 2 / 48).add(identity.y.mul(TAU / 8)).sub(time.mul(0.42)).sin()
    const angle = wave.smoothstep(-0.38, 0.38).mul(Math.PI)
    const turn = angle.cos()
    // A rotating disc projects to an ellipse. The denominator stays finite edge-on.
    const ellipse = vec2(local.x, local.y.div(turn.abs().max(0.035))).length()
    const disc = circle(ellipse, 0.355).mul(recess).mul(turn.abs().smoothstep(0.015, 0.06))
    const front = turn.smoothstep(-0.08, 0.08)
    const enamel = mix(color(hsl.integer(188, 90, 43)), color(hsl.integer(89, 77, 81)), front)
    const axle = local.y.abs().smoothstep(0.018, footprint.add(0.026)).oneMinus().mul(recess)
    const metal = color(hsl.integer(74, 50, 58))
    const housing = mix(mix(color(hsl.integer(225, 36, 13)), color(hsl.integer(241, 40, 7)), recess), metal, bezel.add(axle).clamp())
    const surface = mix(housing, enamel, disc)
    this.colorNode = mix(color(hsl.integer(147, 28, 44)), surface, resolved)
    this.metalnessNode = mix(float(0.25), bezel.add(axle).clamp().mul(disc.oneMinus()).mul(0.8), resolved)
    this.roughnessNode = mix(float(0.46), float(0.34).add(recess.mul(0.23)).sub(disc.mul(0.28)), resolved)
    this.clearcoatNode = disc.mul(0.42).mul(resolved)
    this.clearcoatRoughness = 0.2
    // Keep the enamel normals tilted with the shutters; the bronze rims stay fixed.
    const housingNormal = proceduralNormal(bezel.sub(recess.mul(0.65)).mul(resolved), 0.0009)
    const bitangent = normalViewGeometry.cross(tangentView).mul(tangentGeometry.w).normalize()
    const discNormal = normalViewGeometry.mul(turn.abs().max(0.035)).add(bitangent.mul(angle.sin()).mul(turn.sign())).normalize()
    this.normalNode = mix(housingNormal, discNormal, disc.mul(resolved)).normalize()
  }
}
