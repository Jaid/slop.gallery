import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, mx_fractal_noise_float, normalLocal, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {environmentHighlight, studioSheen} from '../../candidates/deepseek/lib/environment.ts'
import {knotCircumference, knotLength, tubeTorus} from '../../candidates/deepseek/lib/tubeMetric.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Wrapped horizontal distance in object units, so a mark stays round wherever it sits on the tube. */
const wrapAlong = (tube: Node<'vec2'>, center: number) => tube.x.sub(center).add(0.5).fract().sub(0.5).mul(knotLength)
const wrapAround = (tube: Node<'vec2'>, center: number) => tube.y.sub(center).add(0.5).fract().sub(0.5).mul(knotCircumference)
/** A mountain ridge as a periodic silhouette; ink lies below it, paper above. */
const ridge = (tube: Node<'vec2'>, seed: number, base: number, amplitude: number, frequency: number) => {
  const loop = vec2(tube.x.mul(TAU).cos(), tube.x.mul(TAU).sin()).mul(frequency)
  const height = mx_fractal_noise_float(vec3(loop.x, loop.y, seed), 3, 2.02, 0.52).mul(amplitude).add(base)
  return height.sub(tube.y).smoothstep(0.002, 0.025)
}
/**
 * A hanging scroll wrapped around the knot: handmade washi, a layered sumi landscape, a vermilion
 * sun and seal, and a few fugitive flakes of gold. The ink is matte until the eye grazes it; then the
 * paper fibers and the wet edge of the brush appear.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
// Three ranges recede into the mist; the last one is almost a silhouette.
    let ink: Node<'float'> = ridge(tube, 1.7, 0.86, 0.055, 2.1).mul(0.22)
    ink = ink.max(ridge(tube, 5.3, 0.78, 0.07, 3.2).mul(0.46))
    ink = ink.max(ridge(tube, 9.1, 0.7, 0.08, 4.7).mul(0.74))
    ink = ink.max(ridge(tube, 13.4, 0.61, 0.06, 6.1).mul(1))
    const mistCenterA = tube.x.mul(TAU * 2).sin().mul(0.026).add(0.845)
    const mistCenterB = tube.x.mul(TAU * 3).add(1.9).sin().mul(0.018).add(0.72)
    const mistA = tube.y.sub(mistCenterA).abs().smoothstep(0.012, 0.07).oneMinus()
    const mistB = tube.y.sub(mistCenterB).abs().smoothstep(0.008, 0.045).oneMinus()
    const mist = mistA.mul(0.82).add(mistB.mul(0.55)).clamp()
// Ink is not a flat fill: paper tooth, dry-brush breaks and a darker pooled edge.
    const tooth = mx_fractal_noise_float(tubeTorus(tube, 1.2, 1.2).mul(65).add(vec3(0, 0, 3.1)), 2, 2.1, 0.5).mul(0.5).add(0.5)
    const brushBreak = mx_fractal_noise_float(p.mul(26).add(7.4), 2, 2.2, 0.5).mul(0.5).add(0.5)
    const foreground = float(0.54).sub(tube.y).smoothstep(0, 0.06).mul(0.5)
    const splatCoord = p.mul(92).add(12.3)
    const splatRandom = mx_cell_noise_vec3(splatCoord)
    const splatDist = splatCoord.fract().sub(splatRandom.mul(0.5).add(0.25)).length()
    const splat = splatDist.smoothstep(0.09, 0.17).oneMinus().mul(splatRandom.y.smoothstep(0.62, 0.84)).mul(intimate).mul(1.2)
    const seamMist = tube.y.smoothstep(0, 0.07).oneMinus().max(tube.y.smoothstep(0.93, 1))
    const inkDensity = ink.add(foreground).max(splat.mul(ink.mul(0.6).add(0.4))).sub(mist.mul(0.88)).clamp().pow(0.86).mul(1.08).mul(brushBreak.mul(0.25).add(0.85)).mul(tooth.mul(0.12).add(0.94)).mul(seamMist.mul(0.98).oneMinus())
    const inkEdge = ink.mul(mist.oneMinus()).mul(ink.fwidth().smoothstep(0.01, 0.06).oneMinus())
// Washi: warm, cloudy, with long fibers and a few darker pulp flecks.
    const mottle = mx_fractal_noise_float(p.mul(2.6).add(13.2), 3, 2.02, 0.5).mul(0.5).add(0.5)
    const paper = mix(color(hsl.integer(83, 33, 82)), color(hsl.integer(86, 45, 93.6)), mottle)
    const paperWarm = mix(paper, color(hsl.integer(81, 44, 85)), grazing.mul(0.24))
    const fiberField = mx_fractal_noise_float(tubeTorus(tube, 0.22, 3.2).mul(42).add(vec3(0, 0, 17.7)), 2, 2.2, 0.5)
    const fiber = fiberField.abs().smoothstep(0, 0.03).oneMinus().mul(intimate).mul(0.28)
    const fleckField = mx_cell_noise_vec3(tubeTorus(tube, 1.4, 1.4).mul(130).add(vec3(0, 0, 2.4)))
    const fleck = fleckField.x.smoothstep(0.82, 0.9).mul(intimate).mul(0.3)
    const laidPhase = tube.y.mul(TAU * 620).add(tooth.mul(13))
    const laid = laidPhase.sin().abs().smoothstep(0.18, 0.46).mul(laidPhase.fwidth().smoothstep(0.4, 1.3).oneMinus()).mul(intimate).mul(0.055)
    const chainPhase = tube.y.mul(TAU * 26).add(tube.x.mul(TAU * 3))
    const chain = chainPhase.sin().abs().smoothstep(0.02, 0.08).mul(0.018).mul(intimate)
    const paperDetail = mix(paperWarm, color(hsl.integer(77, 28, 46)), fiber.mul(0.9).add(fleck.mul(0.65)).add(laid.mul(0.8)).add(chain))
// Vermilion sun and seal: the only warm, saturated marks in the whole composition.
    const sunDelta = vec2(wrapAlong(tube, 0.58), wrapAround(tube, 0.945)).length()
    const sun = sunDelta.smoothstep(0.075, 0.08).oneMinus()
    const sunHalo = sunDelta.smoothstep(0.1, 0.28).oneMinus().mul(0.06)
    const sealAlong = wrapAlong(tube, 0.77).abs()
    const sealAround = wrapAround(tube, 0.89).abs()
    const sealBox = sealAlong.max(sealAround).smoothstep(0.033, 0.036).oneMinus()
    const sealGlyph = sealAlong.mul(300).sin().abs().smoothstep(0.2, 0.5).mul(sealAround.mul(170).cos().abs().smoothstep(0.15, 0.45))
    const seal = sealBox.mul(sealGlyph.oneMinus().mul(0.75).add(0.25))
// A handful of torn gold flakes, each catching the room from a different angle.
    const flakeField = mx_fractal_noise_float(p.mul(21).add(8.8), 2, 2.2, 0.5).mul(0.5).add(0.5)
    const flakeCell = mx_cell_noise_vec3(p.mul(48).floor()).x
    const flakeMask = flakeField.smoothstep(0.54, 0.68).mul(flakeCell.smoothstep(0.36, 0.62))
    const flakeArea = wrapAlong(tube, 0.42).abs().smoothstep(0.1, 0.3).oneMinus().mul(wrapAround(tube, 0.9).abs().smoothstep(0.07, 0.18).oneMinus())
      .add(wrapAlong(tube, 0.68).abs().smoothstep(0.08, 0.24).oneMinus().mul(wrapAround(tube, 0.84).abs().smoothstep(0.06, 0.14).oneMinus()).mul(0.7)).add(wrapAlong(tube, 0.53).abs().smoothstep(0.06, 0.18).oneMinus().mul(wrapAround(tube, 0.87).abs().smoothstep(0.05, 0.11).oneMinus()).mul(0.5))
    const gold = flakeMask.mul(flakeArea).mul(intimate.mul(0.9).add(0.4)).clamp()
    const inkColor = mix(color(hsl.integer(0, 0, 3.7)), color(hsl.integer(63, 19, 13)), mottle)
    const inkWarm = mix(inkColor, color(hsl.integer(51, 50, 33)), inkEdge.mul(0.18))
    const scroll = mix(mix(paperDetail, inkWarm, inkDensity), color(hsl.integer(32, 87, 45.5)), sun.mul(0.92))
    const sealed = mix(scroll, color(hsl.integer(30, 92, 38)), seal.mul(0.86))
    const goldColor = mix(color(hsl.integer(72, 76, 49)), color(hsl.integer(90, 100, 92)), mottle)
    this.colorNode = mix(sealed, goldColor, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(mix(float(0.79).sub(fiber.mul(0.12)).add(fleck.mul(0.08)), float(0.38).add(tooth.mul(0.12)), inkDensity), float(0.18), gold).clamp(0.05, 0.95)
    this.clearcoatNode = inkDensity.mul(0.18).add(gold.mul(0.6))
    this.clearcoatRoughnessNode = mix(float(0.4), float(0.06), gold).sub(inkDensity.mul(0.1)).clamp(0.02, 0.6)
    this.sheen = 0.14
    this.sheenColor.set(hsl.integer(82, 59, 89.7))
    this.sheenRoughness = 0.62
    this.specularIntensity = 0.38
    this.normalNode = detailNormal(baseNormal, fiber.mul(0.00012).add(fleck.mul(0.000035)).add(laid.mul(0.000025)).add(chain.mul(0.00001)).add(gold.mul(0.00024)).add(inkEdge.mul(0.000018)).add(tooth.mul(0.000025)), 0.9)
    this.aoNode = float(1).sub(inkDensity.mul(0.06)).sub(gold.mul(0.1))
    const goldGlint = environmentHighlight(environment, n, 0.16, {threshold: 1.25}).mul(goldColor).mul(gold)
    const inkSheen = studioSheen(n).mul(color(hsl.integer(81, 37, 74))).mul(inkDensity).mul(time.mul(0.22).add(mottle.mul(6)).sin().mul(0.004).add(0.022))
    const sunGlow = color(hsl.integer(35, 91, 54)).mul(sun.mul(0.05).add(sunHalo))
    const warmRim = color(hsl.integer(79, 68, 83)).mul(grazing.pow(3)).mul(0.035).mul(facing.mul(0.4).add(0.6))
    this.emissiveNode = goldGlint.mul(near.mul(0.4).add(0.7)).add(inkSheen).add(sunGlow).add(warmRim)
  }
}
