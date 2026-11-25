import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

function inkLine(field: Node<'float'>, width: number) {
  const footprint = field.fwidth().max(0.0001)
  return field.abs().smoothstep(width, footprint.mul(1.2).add(width)).oneMinus()
}
function flowingHand(tube: Node<'vec2'>) {
  const row = tube.y.mul(5).floor()
  const linePosition = tube.y.mul(5).fract().sub(0.5)
  const flourish = tube.x.mul(TAU * 9).add(row.mul(1.7)).sin().mul(0.115).add(tube.x.mul(TAU * 17).sub(row).sin().mul(0.035))
  const baseline = inkLine(linePosition.sub(flourish), 0.042)
  const ascender = inkLine(linePosition.add(tube.x.mul(TAU * 4).add(row).sin().mul(0.27)), 0.026).mul(tube.x.mul(TAU * 18).sin().smoothstep(0.36, 0.82))
  const descenderField = linePosition.sub(tube.x.mul(TAU * 6).sub(row.mul(0.7)).cos().mul(0.31)).add(0.08)
  const descender = inkLine(descenderField, 0.021).mul(tube.x.mul(TAU * 14).add(row).cos().smoothstep(0.55, 0.88))
  return baseline.max(ascender).max(descender)
}
/** Warm fibrous vellum carrying parallax ghosts, invented calligraphy and raised gold leaf. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.86)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const paperCloud = mx_fractal_noise_float(p.mul(7).add(vec3(1.3, -2.1, 4.7)), 4, 2.1, 0.53).mul(0.5).add(0.5)
    const fiber = mx_noise_float(p.mul(88).add(paperCloud.mul(2))).mul(0.5).add(0.5)
    const ray = tubeRay()
    const ghostInk = flowingHand(tube.sub(ray.mul(0.018))).mul(near.mul(0.72).add(0.18))
    const hand = flowingHand(tube)
    const row = tube.y.mul(6).floor()
    const glyphCoord = vec2(tube.x.mul(36).add(row.mul(0.5)), tube.y.mul(6))
    const glyphPoint = glyphCoord.fract().sub(0.5)
    const glyphIdentity = vec2(tube.x.mul(36).floor(), row)
    const glyphRandom = cellNoiseVec3(vec3(wrapCell(glyphIdentity, vec2(36, 6)), 63.1))
    const stem = inkLine(glyphPoint.x.sub(glyphRandom.x.sub(0.5).mul(0.18)), 0.048).mul(glyphRandom.y.smoothstep(0.22, 0.34))
    const loopPoint = glyphPoint.sub(vec2(glyphRandom.y.sub(0.5).mul(0.13), glyphRandom.x.sub(0.5).mul(0.1)))
    const loopRadius = vec2(loopPoint.x.div(0.31), loopPoint.y.div(0.38)).length()
    const loop = inkLine(loopRadius.sub(0.74), 0.09).mul(glyphRandom.x.smoothstep(0.38, 0.5))
    const slashField = glyphPoint.x.add(glyphPoint.y.mul(glyphRandom.z.mul(1.4).add(-0.7))).sub(glyphRandom.y.sub(0.5).mul(0.2))
    const slash = inkLine(slashField, 0.043).mul(glyphRandom.z.smoothstep(0.3, 0.44))
    const glyphs = stem.max(loop).max(slash).mul(near.mul(0.78).add(0.22))
// Tiny rubric marks appear only while leaning in, rather than becoming moiré at gallery distance.
    const microRow = tube.y.mul(28).fract().sub(0.5)
    const microDashGate = tube.x.mul(112).fract().smoothstep(0.1, 0.2).mul(tube.x.mul(112).fract().smoothstep(0.72, 0.82).oneMinus())
    const microtext = inkLine(microRow, 0.045).mul(microDashGate).mul(intimate)
    const initialRow = tube.y.mul(2).floor()
    const initialCoord = vec2(tube.x.mul(9).add(initialRow.mul(0.5)), tube.y.mul(2))
    const initialPoint = initialCoord.fract().sub(0.5)
    const initialIdentity = vec2(tube.x.mul(9).floor(), initialRow)
    const initialRandom = cellNoiseVec3(vec3(wrapCell(initialIdentity, vec2(9, 2)), 91.7))
    const initialRadius = initialPoint.length()
    const initialAngle = mx_atan2(initialPoint.y, initialPoint.x.add(0.0001)) as unknown as Node<'float'>
    const medallion = inkLine(initialRadius.sub(0.34), 0.017)
    const petals = inkLine(initialAngle.mul(7).add(initialRandom.x.mul(TAU)).sin().mul(initialRadius), 0.017).mul(initialRadius.smoothstep(0.09, 0.31))
    const goldGate = initialRandom.z.smoothstep(0.76, 0.82)
    const gold = medallion.max(petals).mul(goldGate)
    const parchment = mix(color(hsl.integer(49, 53, 27)), color(hsl.integer(73, 55, 68)), paperCloud.mul(0.68).add(facing.mul(0.1))).mul(fiber.mul(0.08).add(0.95))
    let surface: Node<'vec3'> = mix(parchment, color(hsl.integer(54, 43, 31)), ghostInk.mul(0.22))
    surface = mix(surface, color(hsl.integer(259, 69, 5)), hand.mul(0.94).max(glyphs.mul(0.96)))
    surface = mix(surface, color(hsl.integer(18, 88, 33)), microtext.mul(0.72))
    const leafColor = mix(color(hsl.integer(68, 86, 47)), color(hsl.integer(87, 100, 90.4)), initialRandom.y.mul(0.55).add(facing.mul(0.45)))
    surface = mix(surface, leafColor, gold)
    this.colorNode = surface
    this.metalnessNode = gold.mul(0.98)
    this.roughnessNode = mix(float(0.78), float(0.16), gold).sub(hand.mul(0.16)).add(fiber.mul(0.04))
    this.clearcoatNode = gold.mul(0.42).add(hand.mul(0.08))
    this.clearcoatRoughness = 0.1
    this.sheen = 0.22
    this.sheenColor.set(hsl.integer(79, 59, 83))
    this.sheenRoughness = 0.88
    const relief = paperCloud.mul(0.001).add(fiber.mul(0.00028)).sub(hand.mul(0.0013)).sub(glyphs.mul(0.0008)).add(gold.mul(0.0042))
    this.normalNode = proceduralNormal(relief, 1)
    const spoken = tube.x.mul(TAU * 4).sub(time.mul(0.46)).add(tube.y.mul(TAU * 2)).sin().mul(0.5).add(0.5).pow(13)
    const leafSpark = glints(normalViewGeometry, 125).mul(gold).mul(near)
    this.emissiveNode = color(hsl.integer(266, 90, 44)).mul(hand.max(glyphs)).mul(spoken).mul(0.32).add(color(hsl.integer(94, 100, 94.8)).mul(leafSpark).mul(0.9)).add(color(hsl.integer(359, 78, 34)).mul(ghostInk).mul(grazing.pow(3)).mul(0.055))
  }
}
