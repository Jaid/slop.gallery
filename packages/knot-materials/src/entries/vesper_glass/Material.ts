import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {approach, disk} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import {inkLine as stroke, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Four deliberate pigments rather than a generic RGB rainbow. */
function pigments(t: Node<'float'>, a: Node<'color'>, b: Node<'color'>, c: Node<'color'>, d: Node<'color'>) {
  return mix(mix(a, b, t.smoothstep(0.05, 0.35)), mix(c, d, t.smoothstep(0.68, 0.95)), t.smoothstep(0.38, 0.64))
}
/** Garnet and blue cathedral panes surround fixed leadwork, while back-painted enamel shifts beneath the glass as the viewer moves. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, objectDistance} = viewerFrame()
    const near = approach(objectDistance)
    const modules = vec2(20, 3)
    const q = tube.mul(modules)
    const local = q.fract().sub(0.5)
    const aa = q.fwidth().length().max(0.0001)
    const r = local.length().max(0.00001)
    const theta = mx_atan2(local.y, local.x.add(0.000001)) as unknown as Node<'float'>
    const circle = stroke(r.sub(0.335), 0.012, aa)
    const smallCircle = stroke(r.sub(0.115), 0.011, aa)
    const spokes = stroke(theta.mul(4).sin().mul(r), 0.013, aa.mul(3)).mul(disk(r, 0.338, aa)).mul(disk(r, 0.115, aa).oneMinus())
    const ogive = stroke(local.x.abs().add(local.y.abs()).sub(0.485), 0.014, aa.mul(1.4))
    const border = stroke(local.x.abs().max(local.y.abs()).sub(0.49), 0.009, aa)
    const lead = circle.max(smallCircle).max(spokes).max(ogive).max(border)
    const paneId = theta.add(Math.PI).div(TAU).mul(8).floor()
    const identity = cellNoiseVec3(vec3(q.floor().mod(modules), paneId.add(13)))
    const pigment = pigments(identity.x, color(hsl.integer(8, 89, 33)), color(hsl.integer(43, 86, 58)), color(hsl.integer(197, 90, 51)), color(hsl.integer(268, 89, 32)))
    // The back-painted enamel lies behind the leadwork and shears independently under oblique views.
    const back = tube.sub(tubeRay().mul(0.022)).mul(modules)
    const backLocal = back.fract().sub(0.5)
    const rose = backLocal.length().mul(55).sub(backLocal.y.mul(9)).sin().mul(0.5).add(0.5)
    const ripples = mx_noise_float(p.mul(48)).mul(0.5).add(0.5)
    const glass = pigment.mul(rose.mul(0.27).add(ripples.mul(0.2)).add(0.56))
    const heart = disk(r, 0.104, aa)
    const enamel = mix(glass, color(hsl.integer(78, 88, 78)), heart)
    this.colorNode = mix(enamel, color(hsl.integer(264, 7, 17)), lead)
    this.metalnessNode = lead.mul(0.86)
    this.roughnessNode = mix(float(0.12), float(0.34), lead).add(ripples.mul(0.055))
    this.clearcoat = 1
    this.clearcoatNode = lead.oneMinus().mul(0.9)
    this.clearcoatRoughness = 0.085
    this.ior = 1.52
    this.normalNode = proceduralNormal(lead.mul(0.0018).add(ripples.mul(0.0005)), 0.7)
    // Internal light is painted radiance, so it remains legible without a scene-color transmission buffer.
    const breath = time.mul(0.45).add(tube.x.mul(TAU * 3)).sin().mul(0.14).add(0.76)
    this.emissiveNode = enamel.mul(lead.oneMinus()).mul(breath).mul(near.mul(0.3).add(0.3)).mul(grazing.mul(-0.35).add(1))
    this.aoNode = lead.mul(-0.18).add(1)
  }
}
