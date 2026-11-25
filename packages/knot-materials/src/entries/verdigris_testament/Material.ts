import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2} from 'three/tsl'

import {enamel, etch, filteredCos, ornamentCell, polarAngle, polarTicks, repeatLine} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Derivative-free relief can be evaluated in the vertex stage without importing filtered shader detail. */
function bronzeRelief(tube: Node<'vec2'>) {
  const {q} = ornamentCell(tube, 14, 2, 53)
  const local = vec2(q.x.mul(1.2), q.y)
  const r = local.length()
  const a = polarAngle(local)
  const scrollPhase = r.mul(42).sub(a.mul(2))
  const band = r.smoothstep(0.09, 0.13).mul(r.smoothstep(0.33, 0.39).oneMinus())
  const scroll = scrollPhase.cos().mul(0.5).add(0.5).pow(5).mul(band)
  const frame = r.sub(0.414).div(0.014).pow2().negate().exp()
  const sun = r.div(0.068).pow2().negate().exp()
  return {
    q,
    r,
    a,
    scrollPhase,
    band,
    scroll,
    frame,
    height: scroll.mul(0.0032).add(frame.mul(0.0028)).add(sun.mul(0.002)),
  }
}

/** Cast bronze, raised double spirals, punched scale borders and mineral deposits in every recess. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = data.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const relief = bronzeRelief(tube)
    this.positionNode = positionGeometry.add(normalLocal.mul(relief.height))
    const {q, r, a, scrollPhase, band, scroll, frame} = relief
    const scrollEdge = etch(scrollPhase.sin(), 0.065).mul(band)
    const scale = polarTicks(vec2(q.x.mul(1.2), q.y), 64, 0.09)
      .mul(enamel(r.sub(0.455))).mul(enamel(float(0.424).sub(r)))
    const sunRays = etch(a.mul(8).sin().mul(r), 0.004)
      .mul(enamel(r.sub(0.113))).mul(enamel(float(0.066).sub(r)))
    const sunRing = etch(r.sub(0.067), 0.007)
    const border = etch(q.x.abs().add(q.y.abs()).sub(0.5), 0.004)
    const engraving = scrollEdge.add(scale).add(sunRays).add(sunRing).add(border.mul(0.65)).clamp()
    const mineral = mx_fractal_noise_float(p.mul(8).add(31), 3, 2.1, 0.53).mul(0.5).add(0.5)
    const mottling = mx_noise_float(p.mul(38)).mul(0.5).add(0.5)
    const pores = mx_noise_float(p.mul(120)).mul(0.5).add(0.5)
    const oxide = mineral.smoothstep(0.32, 0.63)
      .mul(scroll.mul(-0.65).add(1)).mul(frame.mul(-0.7).add(1))
      .add(mottling.smoothstep(0.58, 0.76).mul(0.18)).clamp()
    const lantern = tube.x.mul(TAU * 3).sub(time.mul(0.32)).add(a.mul(0.2)).cos().mul(0.5).add(0.5).pow(6)
    const patina = mix(color(hsl.integer(187, 74, 23)), color(hsl.integer(183, 64, 59)), mineral.mul(0.5).add(mottling.mul(0.35)))
      .mul(lantern.mul(near.mul(0.08).add(0.05)).add(1))
    const copper = mix(color(hsl.integer(37, 54, 29)), color(hsl.integer(66, 57, 61)), mineral.mul(0.4).add(pores.mul(0.3)).add(0.2))
    const worn = mix(copper, color(hsl.integer(84, 64, 77)), scroll.mul(0.4).add(frame.mul(0.4)).add(engraving.mul(0.32)).clamp())
    const body = mix(worn, patina, oxide)
    const scratches = repeatLine(tube.y.mul(270).add(filteredCos(tube.x.mul(TAU * 12)).mul(0.7)), 0.015)
      .mul(intimate).mul(oxide.oneMinus()).mul(0.1)
    const poresMask = pores.smoothstep(0.58, 0.75).mul(oxide)
    const whisper = etch(scrollPhase.sin(), 0.028).mul(band).mul(oxide)
      .mul(lantern).mul(near).mul(facing.pow(2))
    this.colorNode = body.mul(poresMask.mul(-0.16).add(1)).add(color(hsl.integer(85, 63, 80)).mul(scratches))
    this.metalnessNode = float(0.95).sub(oxide.mul(0.82))
    this.roughnessNode = float(0.29).add(oxide.mul(0.35)).add(poresMask.mul(0.08)).sub(engraving.mul(0.035))
    this.clearcoat = 0.22
    this.clearcoatNode = oxide.oneMinus().mul(0.22)
    this.clearcoatRoughness = 0.22
    this.normalNode = proceduralNormal(relief.height.add(mottling.mul(oxide).mul(0.00028))
      .add(pores.mul(oxide).mul(0.00008)).sub(engraving.mul(0.00012)), 0.7)
    this.aoNode = float(0.92).sub(oxide.mul(0.14)).add(scroll.mul(0.07)).clamp()
    this.anisotropy = 0.32
    this.anisotropyNode = vec2(1, 0).mul(oxide.oneMinus()).mul(0.32)
    this.emissiveNode = color(hsl.integer(167, 63, 72)).mul(whisper).mul(0.38)
      .add(color(hsl.integer(66, 59, 63)).mul(grazing.pow(3)).mul(scroll).mul(0.018))
  }
}
