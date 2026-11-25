import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, uv, vec2, vec3} from 'three/tsl'

import {loopTurn} from '../../candidates/deepseek/lib/loopClock.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Subpixel paper fibers settle to their mean rather than sparkling. */
function paperGrain(point: Node<'vec3'>) {
  const visibility = point.fwidth().length().smoothstep(0.25, 1).oneMinus()
  return mix(float(0.5), mx_noise_float(point).mul(0.5).add(0.5), visibility)
}
/** Distance from a point to a line segment in the glyph's own square. */
const segmentDistance = (point: Node<'vec2'>, start: Node<'vec2'>, end: Node<'vec2'>) => {
  const span = end.sub(start)
  return point.sub(start).sub(span.mul(point.sub(start).dot(span).div(span.dot(span).max(1e-5)).clamp())).length()
}
/** A codex page wound around the knot. Lines of runic script are ruled onto the parchment, with rule lines, initials and marginal borders in gold leaf. A nib of light travels the page forever: it writes the words just ahead of itself and lets them fade into the margin before it returns. The parchment lifts wherever a visitor stands close, so the text you can actually read is the text near you, and the ink quietly thins out once a stroke falls below a pixel. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, grazing, distance, intimate, near} = viewerFrame()
    const page = uv()
    const row = page.y.mul(9)
    const column = page.x.mul(150)
    const rowIndex = row.floor()
    const glyphIndex = column.floor()
    const inRow = row.fract()
    const inColumn = column.fract()
    const box = vec2(inColumn, inRow)
    const glyphId = mx_cell_noise_float(vec3(glyphIndex, rowIndex, 1.7))
    const shape = (seed: number) => mx_cell_noise_float(vec3(glyphIndex.add(seed * 0.31), rowIndex.add(seed * 0.77), seed * 4.1 + 2.3))
    const branch = (seed: number) => {
      const hash = shape(seed)
      const attach = hash.mul(5.3).fract().mul(0.6).add(0.16)
      const side = hash.mul(11.7).fract().smoothstep(0.35, 0.65).mul(2).sub(1)
      const length = hash.mul(17.3).fract().mul(0.26).add(0.13)
      const start = vec2(float(0.5), attach.add(side.mul(length).mul(0.55)).clamp(0.12, 0.88))
      const end = vec2(float(0.5).add(side.mul(length).mul(0.85)), attach.add(side.mul(length).mul(-0.55)).clamp(0.12, 0.88))
      return segmentDistance(box, start, end)
    }
    const stroke = segmentDistance(box, vec2(0.5, 0.1), vec2(0.5, 0.9)).min(branch(1)).min(branch(2)).min(branch(3))
    const strokeWidth = float(0.032).add(glyphId.mul(0.01))
    // Filter unwrapped coordinates, not changing glyph identities across cell boundaries.
    const footprint = vec2(column, row).fwidth().length()
    const aa = footprint.min(0.025).max(0.0009)
    const inkCoverage = stroke.sub(strokeWidth).smoothstep(aa.negate(), aa).oneMinus()
    const resolved = footprint.smoothstep(strokeWidth.mul(0.85), strokeWidth.mul(2.8)).oneMinus()
    const ink = inkCoverage.mul(resolved)
    const initial = mx_cell_noise_float(vec3(glyphIndex.mul(0.31), rowIndex, 7.3)).smoothstep(0.965, 0.98).mul(ink)
    const carpet = mx_cell_noise_float(vec3(glyphIndex.mul(0.13), 4.4, 9.1)).smoothstep(0.93, 0.955)
    const ruleFootprint = row.fwidth()
    const rule = inRow.sub(0.085).abs().smoothstep(0.005, ruleFootprint.add(0.018).min(0.04)).oneMinus().mul(ruleFootprint.smoothstep(0.03, 0.12).oneMinus())
    const margin = inRow.smoothstep(0.02, 0.05).mul(inRow.smoothstep(0.95, 0.98).oneMinus())
    const yarn = paperGrain(p.mul(vec3(180, 26, 26)))
    const laid = paperGrain(p.mul(vec3(430, 17, 17)).add(3.3))
    const foxing = mx_noise_float(p.mul(vec3(2.6, 1, 1)).add(1.1)).mul(0.5).add(0.5)
    const attention = distance.smoothstep(1, 3.1).oneMinus()
    const parchmentTone = mix(color(hsl.integer(79, 36, 34)), color(hsl.integer(80, 39, 60)), yarn.mul(0.4).add(laid.mul(0.35)).add(0.25))
    const parchment = mix(parchmentTone, color(hsl.integer(74, 51, 27)), foxing.smoothstep(0.62, 0.9).mul(0.45))
    const lit = mix(parchment, parchment.mul(1.5), attention.mul(0.6).add(0.4))
    const tail = loopTurn.sub(page.x).fract()
    const ahead = page.x.sub(loopTurn).fract()
    const quill = ahead.mul(ahead).mul(-3200).exp()
    const wet = tail.mul(tail).mul(-60).exp()
    const written = tail.smoothstep(0.9, 0.995).oneMinus()
    const inkTone = mix(color(hsl.integer(55, 21, 8)), color(hsl.integer(29, 82, 29)), glyphId.smoothstep(0.72, 0.78))
    const goldLeaf = mix(color(hsl.integer(75, 77, 45)), color(hsl.integer(82, 70, 79)), mx_noise_float(p.mul(vec3(11.5, 5.2, 5.2)).add(2.7)).mul(0.5).add(0.5))
    const body = mix(lit, inkTone, ink.mul(written).mul(0.94))
    // Illuminated borders are inset shapes, never whole-cell color or height steps.
    const panel = box.sub(0.5).abs().div(vec2(0.42, 0.4))
    const panelEdge = panel.x.max(panel.y)
    const border = panelEdge.smoothstep(0.76, 0.84).mul(panelEdge.smoothstep(0.92, 1).oneMinus())
    const carpetGold = carpet.mul(border).mul(resolved)
    this.colorNode = mix(mix(mix(body, goldLeaf, initial.mul(0.9).add(carpetGold.mul(0.7)).min(1)), goldLeaf, rule.mul(margin).mul(0.45)), color(hsl.integer(78, 37, 27)), laid.mul(0.08))
    this.roughnessNode = mix(float(0.78), float(0.32), initial.mul(0.8).add(rule.mul(0.6)).min(1)).sub(ink.mul(0.04)).sub(intimate.mul(0.05)).clamp(0.18, 0.85)
    this.metalnessNode = initial.mul(0.85).add(rule.mul(margin).mul(0.45)).add(carpetGold.mul(0.6)).clamp()
    this.sheen = 0.1
    this.sheenColor.set(hsl.integer(83, 34, 75.5))
    this.normalNode = proceduralNormal(ink.mul(0.05).add(initial.mul(0.05)).add(yarn.mul(0.02)).add(laid.mul(0.012)), 0.0005)
    this.emissiveNode = color(hsl.integer(81, 100, 89.6)).mul(quill.mul(1.2))
      .add(color(hsl.integer(88, 69, 91.7)).mul(wet.mul(written)).mul(0.35))
      .add(color(hsl.integer(85, 56, 90)).mul(ink.mul(attention.pow(1.6))).mul(0.3))
      .add(color(hsl.integer(82, 58, 81)).mul(initial.mul(attention.pow(1.2))).mul(0.34))
      .add(color(hsl.integer(78, 56, 54)).mul(grazing.pow(3)).mul(0.06))
      .add(color(hsl.integer(73, 40, 20)).mul(near.mul(0.06)))
  }
}
