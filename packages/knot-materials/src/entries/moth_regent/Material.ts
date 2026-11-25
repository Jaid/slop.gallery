import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {detail, fill, pulse, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Velvet wing scales with nested ocelli and directional, ribbed structural color. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {facing, grazing, intimate} = viewerFrame()
    const tube = uv()
    const rows = tube.y.mul(8)
    const q = vec2(tube.x.mul(64).add(rows.floor().mod(2).mul(0.5)), rows)
    const rnd = cellNoiseVec3(vec3(wrapCell(q.floor(), vec2(64, 8)), 17.2))
    const local = q.fract().sub(0.5)
    // Footprints intentionally exclude the staggered row discontinuity.
    const fw = tube.mul(vec2(64, 8)).fwidth().length().max(0.0001)
    const scaleY = local.y.add(local.x.pow2().mul(0.65))
    const scallop = stroke(scaleY.sub(0.43), 0.035, fw)
    const separation = stroke(local.x.abs().sub(0.49), 0.014, fw)
    const ribs = wave(local.x.mul(TAU * 8).add(local.y.mul(2)))
    const fine = detail(tube.mul(vec2(512, 64)))
    const cap = local.x.mul(Math.PI).cos().max(0).mul(local.y.mul(Math.PI).cos().max(0))
    const flutter = pulse(tube.x.mul(TAU * 5).sub(tube.y.mul(TAU * 2)).sub(time.mul(0.65)))
    const optical = facing.mul(2.4).add(rnd.x.mul(0.4)).add(cap.mul(0.45)).add(flutter.mul(0.35))
    const emerald = mix(color(hsl.integer(186, 87, 23)), color(hsl.integer(167, 72, 66)), optical.sin().mul(0.5).add(0.5))
    const wing = mix(emerald, color(hsl.integer(297, 59, 19)), optical.add(1.4).sin().smoothstep(0.1, 0.95))
      .mul(ribs.mul(fine).mul(0.1).add(0.84)).mul(separation.mul(-0.48).add(1))
    const motifRows = tube.y.mul(2)
    const motif = vec2(tube.x.mul(10).add(motifRows.floor().mod(2).mul(0.5)), motifRows).fract().sub(0.5)
    const r = motif.mul(vec2(2.05, 2.65)).length()
    const af = tube.mul(vec2(20.5, 5.3)).fwidth().length().max(0.0001)
    const eye = fill(r.sub(0.7), af)
    const outerGold = stroke(r.sub(0.63), 0.047, af)
    const lagoon = stroke(r.sub(0.45), 0.077, af)
    const innerGold = stroke(r.sub(0.275), 0.022, af)
    const pupil = fill(r.sub(0.24), af)
    let pigment = mix(wing, color(hsl.integer(217, 38, 14)), eye.mul(0.92))
    pigment = mix(pigment, color(hsl.integer(76, 52, 66)), outerGold.add(innerGold).clamp())
    pigment = mix(pigment, mix(color(hsl.integer(212, 89, 42)), color(hsl.integer(183, 57, 79)), grazing), lagoon)
    pigment = mix(pigment, color(hsl.integer(269, 47, 7)), pupil)
    pigment = pigment.mul(scallop.mul(-0.48).add(1)).mul(rnd.y.mul(0.16).add(0.9))
    this.colorNode = pigment
    this.metalness = 0.36
    this.roughnessNode = mix(float(0.42), float(0.26), lagoon.max(outerGold))
    this.normalNode = proceduralNormal(cap.mul(0.0011).sub(scallop.mul(0.00035)).add(ribs.mul(fine).mul(0.000055)), 1)
    this.iridescenceNode = eye.oneMinus().mul(0.6).add(lagoon.mul(0.45))
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = rnd.x.mul(80).add(310).add(flutter.mul(50))
    this.anisotropy = 0.8
    this.anisotropyNode = vec2(local.x.mul(0.5), float(0.75))
    this.sheenNode = mix(color(hsl.integer(217, 65, 32)), color(hsl.integer(283, 39, 58)), grazing).mul(0.65)
    this.sheenRoughness = 0.42
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.32
    const glintNormal = normalViewGeometry.add(rnd.sub(0.5).mul(0.18)).normalize()
    this.emissiveNode = color(hsl.integer(175, 50, 83)).mul(glints(glintNormal, 140)).mul(cap.pow(4)).mul(intimate).mul(0.09)
  }
}
