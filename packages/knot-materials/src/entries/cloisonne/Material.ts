import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, time, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Imperial enamel in a gold cloison. Each cell hoards its own window of light, so the knot’s jewels take turns as the viewpoint moves. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.62)
    this.name = knotData.id
    const {p, view, facing, grazing, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.5, 4.6).oneMinus()
    const tube = uv()
    const columns = 18
    const rows = 6
    const su = tube.x.mul(columns)
    const sv = tube.y.mul(rows)
    const rnd = cellNoiseVec3(vec3(su.floor().mod(columns), sv.floor().mod(rows), 3.3))
    const cu = su.fract().sub(0.5)
    const cv = sv.fract().sub(0.5)
    const wobble = mx_noise_float(p.mul(7.5)).mul(0.028)
    const r = cu.abs().max(cv.abs()).add(wobble)
    const dome = r.smoothstep(0.12, 0.44).oneMinus()
    const fw = r.fwidth().max(0.001)
    const inner = float(0.4).sub(fw.mul(0.75)).min(0.455)
    const wire = r.smoothstep(inner, inner.add(fw.add(0.016)))
    const choice = rnd.x.mul(4.999)
    const base = choice.lessThan(1).select(color(hsl.integer(261, 90, 23)), choice.lessThan(2).select(color(hsl.integer(163, 96, 33)), choice.lessThan(3).select(color(hsl.integer(21, 89, 28.5)), choice.lessThan(4).select(color(hsl.integer(84, 37, 81)), color(hsl.integer(76, 88, 56))))))
    const enamel = mix(base.mul(0.76), base, rnd.y.mul(0.42).add(0.52))
    const axis = rnd.sub(0.42)
    const align = axis.dot(view).div(axis.length().max(0.2)).smoothstep(0.16, 0.86)
    const glaze = mix(enamel, mix(enamel, color(hsl.integer(245, 100, 92)), 0.42), grazing.mul(0.38))
    const body = mix(glaze.mul(0.6), glaze, dome.mul(0.7).add(0.3)).mul(facing.mul(dome).mul(0.18).add(1))
    const gold = mix(color(hsl.integer(70, 82, 44)), color(hsl.integer(89, 100, 92.5)), facing.pow(0.5).mul(0.72).add(grazing.pow(1.35).mul(0.28)))
    this.colorNode = mix(body, gold, wire)
    this.metalnessNode = wire.mul(0.95)
    this.roughnessNode = mix(float(0.18), float(0.3), wire.oneMinus()).sub(dome.mul(0.05)).clamp(0.07, 0.42)
    this.clearcoatNode = wire.oneMinus().mul(0.8).add(0.12)
    this.clearcoatRoughness = 0.065
    this.ior = 1.6
    this.iridescenceNode = wire.oneMinus().mul(grazing.mul(0.22).add(0.1))
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = rnd.z.mul(260).add(140).add(facing.mul(170)).add(align.mul(90))
    const bubbleScale = p.mul(42)
    const dustScale = p.mul(76)
    const bubbleFade = bubbleScale.fwidth().length().smoothstep(0.4, 0.12).oneMinus()
    const dustFade = dustScale.fwidth().length().smoothstep(0.46, 0.14).oneMinus()
    const glimmer = time.mul(0.75).add(rnd.x.mul(11)).sin().mul(0.5).add(0.5)
    const enamelGlow = enamel.mul(align).mul(dome).mul(wire.oneMinus()).mul(glimmer.mul(0.22).add(0.78))
    this.emissiveNode = enamel.mul(wire.oneMinus()).mul(0.045)
      .add(enamelGlow.mul(0.36))
      .add(color(hsl.integer(96, 100, 96.7)).mul(wire).mul(grazing.pow(1.2).mul(0.7).add(0.35)).mul(0.7))
      .add(enamel.mul(cellularPoints(bubbleScale, 0.025, 0.09, 0.72)).mul(bubbleFade).mul(proximity).mul(wire.oneMinus()).mul(0.32))
      .add(color(hsl.integer(94, 100, 96)).mul(cellularPoints(dustScale, 0.015, 0.055, 0.9)).mul(dustFade).mul(proximity).mul(wire.oneMinus()).mul(0.65))
    const enamelNormal = proceduralNormal(dome.mul(0.85).sub(wire.mul(0.4)), 0.02)
    this.normalNode = enamelNormal
    this.clearcoatNormalNode = enamelNormal
    this.positionNode = p.add(normalLocal.mul(dome.pow(2).mul(0.011)))
  }
}
