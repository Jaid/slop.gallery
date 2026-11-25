import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn, mix, mx_noise_float, negateOnBackSide, step, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const roseField = (tube: Node<'vec2'>) => {
  const q = tube.mul(vec2(7, 1))
  const local = q.fract().sub(0.5)
  const radius = local.length()
  const theta = atan(local.y, local.x.add(0.000001))
  const ringDistance = radius.sub(0.165).abs().min(radius.sub(0.335).abs()).min(radius.sub(0.505).abs()).min(radius.sub(0.69).abs())
  const petalArc = radius.sub(0.255).sub(theta.cos().mul(6).sin().mul(0.055)).abs()
  const spoke = theta.mul(6).sin().abs().mul(radius.smoothstep(0.14, 0.19)).mul(float(1).sub(radius.smoothstep(0.63, 0.68)))
  const outerSpoke = theta.mul(12).sin().abs().mul(radius.smoothstep(0.49, 0.53)).mul(float(1).sub(radius.smoothstep(0.65, 0.69)))
  const leadDistance = ringDistance.min(petalArc.mul(0.78)).min(spoke.mul(0.72)).min(outerSpoke.mul(0.8))
  const footprint = ringDistance.fwidth().max(theta.fwidth().mul(radius.max(0.08))).max(0.0004)
  const lead = leadDistance.smoothstep(0.009, float(0.009).add(footprint.mul(1.25))).oneMinus()
  const inner = float(1).sub(radius.smoothstep(0.13, 0.16))
  return {
    local,
    radius,
    theta,
    lead,
    inner,
  }
}
// Vertex-safe geometry field: fwidth is intentionally kept out of the displacement stage.
const roseGeometry = (tube: Node<'vec2'>) => {
  const q = tube.mul(vec2(7, 1))
  const local = q.fract().sub(0.5)
  const radius = local.length()
  const theta = atan(local.y, local.x.add(0.000001))
  const ringDistance = radius.sub(0.165).abs().min(radius.sub(0.335).abs()).min(radius.sub(0.505).abs()).min(radius.sub(0.69).abs())
  const petalArc = radius.sub(0.255).sub(theta.cos().mul(6).sin().mul(0.055)).abs()
  const spoke = theta.mul(6).sin().abs().mul(radius.smoothstep(0.14, 0.19)).mul(float(1).sub(radius.smoothstep(0.63, 0.68)))
  const outerSpoke = theta.mul(12).sin().abs().mul(radius.smoothstep(0.49, 0.53)).mul(float(1).sub(radius.smoothstep(0.65, 0.69)))
  const leadDistance = ringDistance.min(petalArc.mul(0.78)).min(spoke.mul(0.72)).min(outerSpoke.mul(0.8))
  const lead = leadDistance.smoothstep(0.009, 0.018).oneMinus()
  const inner = float(1).sub(radius.smoothstep(0.13, 0.16))
  return {
    radius,
    lead,
    inner,
  }
}
const glassPosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const {radius, lead, inner} = roseGeometry(tube)
  const paneDome = inner.mul(radius.oneMinus().clamp().mul(0.0045))
  return position.add(normal.mul(lead.mul(0.011).add(paneDome)))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    this.envMapIntensity = 1.15
    const tube = uv()
    const {radius, theta, lead} = roseField(tube)
    const epsilon = 0.0001
    const du = glassPosition(tube.add(vec2(epsilon, 0))).sub(glassPosition(tube.sub(vec2(epsilon, 0))))
    const dv = glassPosition(tube.add(vec2(0, epsilon))).sub(glassPosition(tube.sub(vec2(0, epsilon))))
    const formNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = glassPosition(tube)
    const {p, view, grazing, near, intimate} = viewerFrame()
    const cell = tube.mul(vec2(7, 1)).floor()
    const sector = theta.add(Math.PI).div(TAU / 12).floor().mod(12)
    const ring = step(0.165, radius).add(step(0.335, radius)).add(step(0.505, radius)).add(step(0.69, radius))
    const identity = cellNoiseVec3(vec3(sector.add(0.5), ring.add(0.5), cell.x.mul(0.17).add(9.2)))
    const paneA = mix(color(hsl.integer(256, 93, 35)), color(hsl.integer(359, 83, 34.5)), identity.x)
    const paneB = mix(color(hsl.integer(187, 98, 56)), color(hsl.integer(73, 95, 70)), identity.y)
    const stainedGlass = mix(paneA, paneB, identity.z.smoothstep(0.24, 0.82))
    const parallaxP = p.sub(view.mul(0.055))
    const inclusions = mx_noise_float(parallaxP.mul(31).add(vec3(identity.x.mul(5), identity.y.mul(7), identity.z.mul(3)))).mul(0.5).add(0.5)
    const bubbleField = mx_noise_float(parallaxP.mul(72).add(vec3(2.7, 9.1, 4.3)))
    const bubbles = bubbleField.abs().smoothstep(0.035, 0.095).oneMinus().mul(intimate)
    const angle = view.dot(vec3(0.47, 0.31, -0.82)).mul(0.5).add(0.5)
    const backlight = angle.mul(0.055).add(0.07).add(near.mul(0.025))
    const breath = time.mul(0.16).add(identity.z.mul(TAU)).sin().mul(0.025).add(0.975)
    this.colorNode = mix(stainedGlass, color(hsl.integer(262, 17, 12)), lead.mul(0.94)).mul(bubbles.mul(-0.1).add(1))
    this.metalnessNode = lead.mul(0.72)
    this.roughnessNode = mix(float(0.095), float(0.31), lead).add(bubbles.mul(0.12)).add(inclusions.mul(0.025))
    this.transmissionNode = lead.oneMinus().mul(0.84)
    this.thicknessNode = lead.oneMinus().mul(0.3).add(0.08)
    this.ior = 1.52
    this.dispersion = 0.12
    this.attenuationColor.set(hsl.integer(207, 52, 89))
    this.attenuationDistance = 1.1
    this.clearcoat = 0.35
    this.clearcoatRoughnessNode = float(0.08).add(lead.mul(0.16))
    this.normalNode = negateOnBackSide(formNormal)
    this.clearcoatNormalNode = proceduralNormal(lead.mul(0.0022).add(bubbles.mul(0.0005)).add(inclusions.mul(0.00008)), 0.72)
    this.iridescence = 0.12
    this.iridescenceThicknessNode = angle.mul(180).add(radius.mul(120)).add(260)
    this.aoNode = float(1).sub(lead.mul(0.46))
    this.emissiveNode = stainedGlass.mul(lead.oneMinus()).mul(backlight).mul(breath)
      .add(color(hsl.integer(93, 100, 96)).mul(bubbles).mul(grazing).mul(0.035))
      .add(color(hsl.integer(220, 100, 94.4)).mul(radius.smoothstep(0.69, 0.72)).mul(lead.oneMinus()).mul(0.025))
  }
}
