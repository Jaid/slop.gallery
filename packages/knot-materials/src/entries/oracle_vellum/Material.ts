import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, uv, vec2} from 'three/tsl'

import {breath, tangentViewFrame} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {fill, resolved, segmentDistance, stroke, tiles, torusNoise, wave} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import {engravedNormal} from '../../candidates/gpt_sol/lib/exhibition/ReliefKnotMaterial.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** A small calligraphic alphabet of curved bowls, slanted stems, hooks and disconnected diacritics. */
function scriptInk(point: Node<'vec2'>, random: Node<'vec3'>, aa: Node<'float'>) {
  const p = point.mul(vec2(1.4, 1))
  const stem = segmentDistance(p, vec2(-0.11, -0.29), vec2(random.x.mul(0.12).sub(0.045), 0.27))
  const bowlPoint = p.sub(vec2(0.055, -0.01)).mul(vec2(1.2, 1.05))
  const bowl = bowlPoint.length().sub(0.19).abs()
  const hook = segmentDistance(p, vec2(-0.11, -0.29), vec2(0.2, -0.22))
  const slash = segmentDistance(p, vec2(-0.22, 0.08), vec2(0.17, 0.17))
  const penWidth = p.y.mul(7).sin().mul(0.003).add(0.014)
  const ink = stroke(stem.min(hook), penWidth, aa)
    .max(stroke(bowl, penWidth, aa).mul(p.x.smoothstep(-0.03, 0.01)).mul(random.y.smoothstep(0.18, 0.3)))
    .max(stroke(slash, 0.007, aa).mul(random.z.smoothstep(0.55, 0.65)))
  const dot = fill(p.sub(vec2(0.08, 0.34)).length().sub(0.018), aa).mul(random.y.smoothstep(0.65, 0.8))
  return ink.max(dot).mul(random.x.smoothstep(0.07, 0.15))
}

/** Warm vellum, unreadable black ink and battered gold marginalia, with a latent second manuscript. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = data.id
    const tube = uv()
    const {p, grazing, intimate, near} = viewerFrame()
    const {along} = tangentViewFrame()
    const writing = tiles(tube, 84, 18, 5.2)
    const script = scriptInk(writing.point, writing.random, writing.footprint).toVar()
    const marginPhase = tube.y.mul(TAU * 3)
    const textPanel = marginPhase.cos().smoothstep(-0.68, -0.35)
    const text = script.mul(textPanel).mul(near.mul(0.2).add(0.8)).toVar()
    const rubric = writing.random.z.smoothstep(0.86, 0.95)
    const latent = tiles(tube.add(vec2(0.007, 0.005)), 84, 18, 17.6)
    const ghost = scriptInk(latent.point, latent.random, latent.footprint).mul(textPanel)
      .mul(grazing.smoothstep(0.28, 0.86)).mul(along.smoothstep(-0.6, 0.7)).mul(intimate).mul(0.55)
    const ornament = tiles(tube, 18, 3, 31.8)
    const op = ornament.point.mul(vec2(1.7, 1))
    const leaf = op.mul(vec2(1.05, 1.45)).length().sub(0.29)
    const leafBorder = stroke(leaf, 0.007, ornament.footprint)
    const spine = stroke(op.x.sub(op.y.mul(0.22)), 0.008, ornament.footprint).mul(fill(leaf, ornament.footprint))
    const veinPhase = op.y.mul(52).add(op.x.abs().mul(-38))
    const veins = stroke(veinPhase.sin(), 0.04, ornament.footprint.mul(60))
      .mul(fill(leaf, ornament.footprint)).mul(0.6)
    const leafBody = fill(leaf, ornament.footprint).mul(0.22)
    const floral = leafBorder.max(spine).max(veins).max(leafBody).mul(textPanel.oneMinus())
    const borderA = stroke(marginPhase.cos().add(0.46), 0.015, marginPhase.fwidth())
    const borderB = stroke(marginPhase.cos().add(0.8), 0.01, marginPhase.fwidth())
    const gold = floral.max(borderA).max(borderB).toVar()
    const aging = torusNoise(tube, 8, 3, 6).mul(0.5).add(0.5).toVar()
    const stains = torusNoise(tube, 3, 1.3, 21).mul(0.5).add(0.5)
    const pulpCoordinates = p.mul(290)
    const pulp = mx_noise_float(pulpCoordinates).mul(resolved(pulpCoordinates))
    const fiberPhase = tube.x.mul(TAU * 780).add(torusNoise(tube, 10, 4, 13).mul(2))
    const fiber = wave(fiberPhase).mul(intimate).toVar()
    const paper = mix(color(hsl.integer(75, 39, 60)), color(hsl.integer(87, 53, 89)), aging.mul(0.55).add(0.4))
      .mul(stains.mul(0.14).add(0.83)).mul(pulp.mul(0.06).add(1))
    const ink = mix(color(hsl.integer(213, 16, 15)), color(hsl.integer(36, 75, 38)), rubric)
    const livingInk = tube.x.mul(TAU * 2).add(breath).sin().mul(0.025).add(0.975)
    const redMargin = fill(leaf, ornament.footprint).mul(textPanel.oneMinus()).mul(0.32)
    let page = mix(mix(paper, color(hsl.integer(31, 77, 38)), redMargin), ink, text.mul(livingInk))
    page = mix(page, color(hsl.integer(190, 8, 45)), ghost)
    const foil = mix(color(hsl.integer(73, 70, 45)), color(hsl.integer(87, 65, 85)), aging)
      .mul(mx_noise_float(p.mul(90)).mul(0.13).add(0.88))
    const abradedGold = gold.mul(aging.smoothstep(0.18, 0.38)).toVar()
    this.colorNode = mix(page, foil, abradedGold)
    this.metalnessNode = abradedGold.mul(0.94)
    this.roughnessNode = mix(float(0.75).sub(aging.mul(0.12)), float(0.3), abradedGold)
    const relief = pulp.mul(0.000055).add(fiber.mul(0.000018))
      .add(torusNoise(tube, 12, 4, 9).mul(0.0003)).add(abradedGold.mul(0.00017)).sub(text.mul(0.000065))
      .add(gold.mul(breath.sin()).mul(0.000012))
    this.normalNode = engravedNormal(normalViewGeometry, relief)
    this.clearcoat = 0.12
    this.clearcoatNode = abradedGold.mul(0.18).add(0.04)
    this.clearcoatRoughness = 0.42
    this.sheen = 0.23
    this.sheenColor.set(hsl.integer(77, 26, 67))
    this.sheenRoughness = 0.85
    this.specularIntensity = 0.45
    this.aoNode = aging.mul(0.12).add(0.88)
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'latent ink and broken gold leaf',
    }
  }
}
