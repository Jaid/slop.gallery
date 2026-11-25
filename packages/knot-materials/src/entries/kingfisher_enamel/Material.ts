import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {angle, coverage, ring, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/fields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Peacock-eye cloisonné: domed vitreous enamel separated by raised, warm brass wire. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, intimate} = viewerFrame()
    const tube = uv()
    const q = tube.mul(vec2(26, 4))
    const aa = q.fwidth().length().max(0.0001)
    const c = q.fract().sub(0.5)
    const feather = vec2(c.x.mul(1.5).mul(c.y.mul(-0.45).add(1)), c.y)
    const r = feather.length()
    const theta = angle(feather)
    const perimeter = r.sub(0.445)
    const featherMask = coverage(perimeter, aa)
    const featherWire = stroke(perimeter, 0.009, aa)
    const eyePoint = c.sub(vec2(0, 0.095)).mul(vec2(1.9, 1.45))
    const eyeR = eyePoint.length()
    const eyeOuter = coverage(eyeR.sub(0.255), aa)
    const eyeInner = coverage(eyeR.sub(0.16), aa)
    const eyeCore = coverage(eyeR.sub(0.078), aa)
    const wire = featherWire.max(ring(eyeR, 0.255, 0.01, aa)).max(ring(eyeR, 0.16, 0.008, aa)).max(ring(eyeR, 0.078, 0.007, aa))
    const barbs = stroke(theta.mul(13).sin().mul(r), 0.0035, aa).mul(featherMask).mul(eyeOuter.oneMinus())
    const granules = mx_noise_float(p.mul(140)).mul(0.5).add(0.5)
    const directional = view.x.mul(0.3).add(view.y.mul(0.3)).add(grazing.mul(0.4)).add(0.3).clamp()
    const turquoise = mix(color(hsl.integer(194, 96, 45)), color(hsl.integer(183, 92, 65)), directional)
    let enamel = mix(color(hsl.integer(242, 80, 17)), turquoise, featherMask)
    enamel = mix(enamel, color(hsl.integer(58, 86, 60)), eyeOuter)
    enamel = mix(enamel, color(hsl.integer(251, 83, 39)), eyeInner)
    enamel = mix(enamel, color(hsl.integer(254, 72, 13)), eyeCore)
    enamel = enamel.mul(granules.mul(0.13).add(0.89))
    const metal = wire.max(barbs.mul(0.68))
    this.colorNode = mix(enamel, color(hsl.integer(86, 68, 69)), metal)
    this.metalnessNode = mix(float(0.13), float(0.88), metal)
    this.roughnessNode = mix(float(0.2), float(0.29), metal)
    this.clearcoat = 1
    this.clearcoatNode = metal.mul(-0.65).add(0.95)
    this.clearcoatRoughness = 0.085
    this.iridescence = 0.24
    this.iridescenceNode = featherMask.mul(eyeOuter.oneMinus()).mul(0.24)
    this.iridescenceThicknessNode = r.mul(220).add(260)
    const dome = r.div(0.45).clamp().pow(2).oneMinus().mul(featherMask)
    this.normalNode = proceduralNormal(dome.mul(0.002).add(wire.mul(0.0013)).add(barbs.mul(0.0004)).add(granules.mul(intimate).mul(0.00008)), 0.7)
    const glimmer = wave(tube.x.mul(Math.PI * 12).sub(time.mul(0.22))).mul(0.5).add(0.5).pow(6)
    this.emissiveNode = color(hsl.integer(79, 83, 79)).mul(wire).mul(glimmer).mul(grazing).mul(0.13)
  }
}
