import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, tangentGeometry, uv, vec2} from 'three/tsl'

import {buriedUv} from '../../candidates/gpt_sol/lib/exhibition/buriedOptics.ts'
import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {fill, stroke, tiles, wave} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A three-view lenticular art print under cylindrical polycarbonate lenses – not thin-film rainbow metal. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const tube = uv()
    const {view, near, intimate} = viewerFrame()
    const printUv = buriedUv(tube, view, 0.003, 1.49)
    const {local: p} = tiles(printUv, [16, 2], 163, false)
    const breathing = exhibitionPhase.sin().mul(0.09)
// View A: broad vermilion rivers with ivory banks and fine black lithographic key lines.
    const riverPhase = printUv.x.mul(TAU * 32).add(printUv.y.mul(TAU * 2).sin().mul(4.2)).add(breathing)
    const river = wave(riverPhase).smoothstep(0.34, 0.66)
    const keyLine = stroke(riverPhase.sin(), 0.065).mul(riverPhase.fwidth().smoothstep(0.6, 2.5).oneMinus())
    let warm = mix(color(hsl.integer(33, 98, 60.6)), color(hsl.integer(72, 100, 86)), river)
    warm = mix(warm, color(hsl.integer(3, 50, 13)), keyLine.mul(0.8))
// View B: offset concentric targets, with slightly squared contours like a screen-printed optical poster.
    const targetP = p.sub(vec2(0.035, -0.045))
    const targetR = targetP.pow2().pow2().x.add(targetP.pow2().pow2().y).max(1e-8).pow(0.25)
    const targetPhase = targetR.mul(61).add(breathing.mul(1.4))
    const target = wave(targetPhase).smoothstep(0.34, 0.66)
    const pupil = fill(targetR.sub(0.072))
    let cool = mix(color(hsl.integer(271, 96, 28.5)), color(hsl.integer(300, 67, 72)), target)
    cool = mix(cool, color(hsl.integer(73, 100, 78.7)), pupil)
// View C: nested offset diamonds and a broad cream/ink checker, interrupted by saffron diagonals.
    const diamond = p.x.add(p.y.mul(0.15)).abs().add(p.y.abs())
    const labyrinthPhase = diamond.mul(48)
    const labyrinth = wave(labyrinthPhase).smoothstep(0.38, 0.62)
    const checker = printUv.x.mul(32).floor().add(printUv.y.mul(4).floor()).mod(2)
    let graphic = mix(color(hsl.integer(278, 29, 12)), color(hsl.integer(92, 68, 92)), labyrinth.mul(0.78).add(checker.mul(0.22)))
    const sash = stroke(p.x.sub(p.y).sub(0.04), 0.042)
    graphic = mix(graphic, color(hsl.integer(87, 89, 79)), sash.mul(0.85))
// Local incidence selects distinct pictures. Refraction bounds the change at the silhouette.
    const n = normalLocal.normalize()
    const tangent = tangentGeometry.xyz.normalize()
    const across = view.dot(tangent).div(view.dot(n).abs().max(0.24)).atan().mul(3.15)
    const a = across.cos().mul(0.5).add(0.5).pow(5)
    const b = across.add(TAU / 3).cos().mul(0.5).add(0.5).pow(5)
    const c = across.sub(TAU / 3).cos().mul(0.5).add(0.5).pow(5)
    const art = warm.mul(a).add(cool.mul(b)).add(graphic.mul(c)).div(a.add(b).add(c).max(0.00001))
// Millimeter-scale lenses vanish into a smooth glossy cover once their footprints become unresolved.
    const lensPhase = tube.x.mul(TAU * 768)
    const lens = wave(lensPhase)
    const frame = stroke(printUv.y.mul(2).fract().sub(0.015), 0.0035)
    const registerP = p.sub(vec2(0.4, 0.395))
    const register = stroke(registerP.length().sub(0.032), 0.004).max(stroke(registerP.x, 0.003).mul(fill(registerP.y.abs().sub(0.045))))
      .mul(fill(registerP.length().sub(0.055)))
    const markings = frame.max(register).mul(0.8)
    this.colorNode = mix(art, color(hsl.integer(269, 29, 13)), markings)
    this.metalness = 0
    this.ior = 1.49
    this.roughnessNode = float(0.23).sub(lens.mul(intimate).mul(0.05)).add(markings.mul(0.09))
    this.clearcoat = 0.87
    this.clearcoatRoughness = 0.045
    this.specularIntensity = 0.65
    this.normalNode = proceduralNormal(lens.mul(0.00019).add(markings.mul(0.00004)), 1)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = art.mul(near.mul(0.014).add(0.008))
  }
}
