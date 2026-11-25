import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, uv, vec2, vec3} from 'three/tsl'

import {buriedUv} from '../../candidates/gpt_sol/lib/exhibition/buriedOptics.ts'
import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {fill, resolved, segment, stroke, tiles, wave} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** An authored alphabet of stems, crossbars, hooks and diacritics; cell identities choose the ligatures. */
function writing(tube: Node<'vec2'>, seed: number) {
  const {local: p, cell, random, coordinate} = tiles(tube, [96, 8], seed, false)
  const choices = cellNoiseVec3(vec3(cell, seed + 29))
  const slant = vec2(p.x.add(p.y.mul(0.16)), p.y)
  const width = 0.018
  let ink = stroke(segment(slant, vec2(-0.18, -0.31), vec2(-0.12, 0.3)), width)
  const strokes: Array<[number, number, number, number]> = [[-0.15, 0.22, 0.17, 0.22], [-0.15, -0.02, 0.2, 0.04], [-0.18, -0.28, 0.18, -0.24], [0.18, -0.24, 0.18, 0.2], [-0.13, 0.3, 0.23, -0.28], [-0.17, -0.16, 0.21, 0.16]]
  for (const [i, [ax, ay, bx, by]] of strokes.entries()) {
    const selector = random.x.mul(13 + i * 7).add(choices.y.mul(3)).fract().smoothstep(0.46, 0.49)
    ink = ink.max(stroke(segment(slant, vec2(ax, ay), vec2(bx, by)), width).mul(selector))
  }
  const hookP = slant.sub(vec2(0.04, 0.04))
  const hook = stroke(hookP.length().sub(0.17), width).mul(fill(hookP.x.negate().sub(0.03)))
  ink = ink.max(hook.mul(choices.x.smoothstep(0.48, 0.51)))
  const dot = fill(slant.sub(vec2(0.14, 0.345)).length().sub(0.033)).mul(choices.z.smoothstep(0.62, 0.65))
  const wordGap = random.y.smoothstep(0.16, 0.19)
  return {
    ink: ink.max(dot).mul(wordGap).mul(resolved(coordinate, 0.7, 2.3)),
    row: cell.y,
    random,
  }
}

/** Fibrous vellum, rubricated visible writing and a deeper gilded script only a glancing reader can find. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    const present = writing(tube, 83)
    const erased = writing(buriedUv(tube, view, 0.017, 1.4).add(vec2(1 / 192, 1 / 32)), 107)
    const buried = writing(buriedUv(tube, view, 0.007, 1.4), 97)
    const aging = mx_fractal_noise_float(p.mul(13).add(4.2), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const foxing = mx_noise_float(p.mul(69)).smoothstep(0.45, 0.8).mul(aging.smoothstep(0.45, 0.67))
    const vellum = mix(color(hsl.integer(73, 62, 62)), color(hsl.integer(87, 68, 89.5)), aging.mul(0.47).add(0.53))
    const ruling = stroke(tube.y.mul(8).fract().sub(0.09), 0.0025).mul(0.24)
    let paper: Node<'vec3'> = mix(vellum, color(hsl.integer(51, 54, 41)), foxing.mul(0.17).max(ruling))
    paper = mix(paper, color(hsl.integer(177, 21, 46)), buried.ink.mul(0.15))
    const rubric = present.row.mod(4).lessThan(1).select(color(hsl.integer(31, 83, 37)), color(hsl.integer(50, 35, 22)))
    paper = mix(paper, rubric, present.ink.mul(0.84))
// Gilding is revealed by an oblique, object-local view, not by a screen-space mask or camera rotation hack.
    const reveal = view.dot(vec3(0.61, -0.24, 0.75).normalize()).abs().smoothstep(0.28, 0.8)
      .mul(grazing.smoothstep(0.08, 0.58)).mul(near.mul(0.65).add(0.35))
    const remember = exhibitionPhase.add(tube.x.mul(TAU * 3)).sin().mul(0.16).add(0.84)
    const goldInk = erased.ink.mul(reveal).mul(present.ink.mul(0.7).oneMinus()).mul(remember)
    paper = mix(paper, color(hsl.integer(85, 73, 79)), goldInk)
    const {local: m, random} = tiles(tube, [12, 2], 89, false)
    const sealP = m.sub(vec2(0.3, -0.29))
    const r = sealP.length()
    const seal = fill(r.sub(0.108)).mul(random.z.smoothstep(0.43, 0.46))
    const medallion = stroke(r.sub(0.082), 0.007).max(stroke(r.sub(0.043), 0.004))
    const rays = stroke(sealP.y.atan(sealP.x).mul(8).sin(), 0.08).mul(fill(r.sub(0.07))).mul(fill(r.negate().add(0.045)))
    paper = mix(paper, mix(color(hsl.integer(25, 87, 25)), color(hsl.integer(29, 85, 42)), r.div(0.11).clamp()), seal)
    paper = mix(paper, color(hsl.integer(83, 64, 76)), medallion.max(rays).mul(seal))
    this.colorNode = paper
    this.metalnessNode = goldInk.mul(0.85).max(medallion.mul(seal).mul(0.65))
    this.roughnessNode = mix(float(0.84), float(0.28), goldInk).sub(seal.mul(0.24))
    this.sheenNode = color(hsl.integer(85, 37, 80)).mul(goldInk.oneMinus()).mul(0.12)
    this.sheenRoughness = 0.9
    this.clearcoatNode = seal.mul(0.34)
    this.clearcoatRoughness = 0.13
    const fold = tube.x.mul(TAU * 12).sin().mul(tube.y.mul(TAU * 2).cos()).mul(0.0015)
    const grainQ = p.mul(300)
    const grain = mx_noise_float(grainQ).mul(resolved(grainQ)).mul(intimate)
    const fibers = wave(tube.x.mul(TAU * 2100).add(tube.y.mul(TAU * 6).sin().mul(2)))
    this.positionNode = positionGeometry.add(normalLocal.mul(fold))
    this.normalNode = proceduralNormal(fold.add(grain.mul(0.00008)).add(fibers.mul(0.000026)).sub(present.ink.mul(0.000065)).add(seal.mul(0.0008)), 1)
    this.emissiveNode = color(hsl.integer(85, 78, 84)).mul(goldInk).mul(remember).mul(0.13)
  }
}
