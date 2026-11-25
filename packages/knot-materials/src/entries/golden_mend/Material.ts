import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec3, normalLocal, positionGeometry, time} from 'three/tsl'

import {voronoiCells} from '../../candidates/deepseek/lib/voronoiCells.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Kintsugi. A knot of pale porcelain was dropped, and every fracture was filled with lacquer and dusted with gold. The shards no longer sit flush: each one keeps its own height and tilt, and the gilded seams bridge the steps between them. The seams stand proud of the glaze, so they catch the studio lights as hard, warm slivers while the porcelain stays cool and quiet. Lean in and the glaze reveals its own hairline crazing. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, grazing, intimate} = viewerFrame()
// The break network: a warped Voronoi skeleton, so no two shards are alike.
    const warp = mx_noise_vec3(p.mul(3.4)).mul(0.12)
    const q = p.add(warp)
    const shards = voronoiCells(q.mul(3.6))
    const crack = shards.edge
    const crackAA = crack.fwidth().max(0.0004)
// Hand-applied lacquer: the seam breathes in and out along its length.
    const seamWidth = mx_noise_float(q.mul(9)).mul(0.5).add(0.5).mul(0.022).add(0.03)
    const goldMask = crack.smoothstep(seamWidth, seamWidth.add(crackAA.mul(3))).oneMinus()
// A second, finer break network: the glaze's own crazing, never gilded.
    const crazing = mx_worley_noise_vec3(q.mul(13), 1, 0)
    const crazingField = crazing.y.sub(crazing.x)
    const crazingAA = crazingField.fwidth().max(0.0004)
    const crazingMask = crazingField.smoothstep(0.004, crazingAA.mul(3).add(0.004)).oneMinus().mul(intimate)
// Porcelain body: warm, faintly translucent, with a whisper of kiln variation.
    const kiln = mx_noise_float(p.mul(4.5)).mul(0.5).add(0.5)
    const speck = mx_noise_float(p.mul(120)).mul(0.5).add(0.5)
    const porcelain = mix(color(hsl.integer(83, 41, 86)), color(hsl.integer(87, 75, 97)), kiln.mul(0.6).add(speck.mul(0.25)))
// Gold: warm, slightly granular, brighter where the lacquer pooled.
    const goldGrain = mx_noise_float(q.mul(70)).mul(0.5).add(0.5)
    const gold = mix(color(hsl.integer(74, 95, 62)), color(hsl.integer(90, 100, 90)), goldGrain.mul(0.55).add(goldMask.mul(0.3)))
// The seam is proud of the glaze, so its flanks catch a thin bright edge.
    const seamEdge = goldMask.mul(goldMask.oneMinus()).mul(4)
// A rounded bead of lacquer, highest along the middle of the break.
    const bead = crack.div(seamWidth).clamp(0, 1).smoothstep(0, 1).oneMinus()
// Every shard keeps a small height offset and tilt of its own, so the knot
// reads as genuinely reassembled rather than as a painted pattern.
    const shardRandom = cellNoiseVec3(shards.identity.add(7.3))
    const shardTilt = shards.local.sub(0.5).dot(shardRandom.mul(2).sub(1))
    const shardHeight = shardRandom.z.sub(0.5).mul(0.0026).add(shardTilt.mul(0.0018))
// The vertex stage cannot use derivatives, so the relief uses fixed widths.
    const crazingRelief = crazingField.smoothstep(0.004, 0.01).oneMinus().mul(intimate)
    const height = shardHeight.add(bead.mul(0.0052)).sub(crazingRelief.mul(0.0004))
    this.colorNode = mix(porcelain, gold, goldMask).mul(crazingMask.mul(0.35).oneMinus())
    this.metalnessNode = goldMask
    this.roughnessNode = mix(float(0.09).add(kiln.mul(0.03)), float(0.26).sub(goldGrain.mul(0.1)), goldMask)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.ior = 1.55
    this.normalNode = proceduralNormal(height, 1)
    this.clearcoatNormalNode = this.normalNode
// A breath of warmth in the deepest lacquer, as if the gold were still cooling.
    const ember = goldMask.mul(goldMask).mul(mx_noise_float(q.mul(24)).mul(0.5).add(0.5)).mul(time.mul(0.4).sin().mul(0.15).add(0.85))
    this.emissiveNode = color(hsl.integer(78, 100, 89)).mul(grazing.pow(3)).mul(0.05).add(color(hsl.integer(62, 100, 74)).mul(ember).mul(intimate.mul(0.5).add(0.12)).mul(0.16)).add(color(hsl.integer(92, 100, 96)).mul(seamEdge).mul(grazing.pow(2)).mul(0.25))
    this.aoNode = goldMask.mul(0.25).add(crazingMask.mul(0.2)).oneMinus().mul(0.35).add(0.65)
    this.positionNode = positionGeometry.add(normalLocal.mul(height))
  }
}
