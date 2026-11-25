import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, mx_worley_noise_vec3, normalViewGeometry, select, time, uv, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {ramp} from '../../candidates/deepseek/lib/ramp.ts'
import {knotCircumference, knotLength, tubeMetric} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const roseSpacing = knotLength / 7
const roseRadius = 0.335
const ringStep = 0.073
const sectors = 12
const palette = (selector: Node<'float'>, ring: Node<'float'>, r: Node<'float'>) => {
  const ruby = color(hsl.integer(19, 95, 38))
  const sapphire = color(hsl.integer(264.3, 94, 23.8))
  const emerald = color(hsl.integer(164, 97, 35))
  const amber = color(hsl.integer(77, 85, 68))
  const violet = color(hsl.integer(303, 81, 25))
  const gold = color(hsl.integer(88, 78, 87))
  const outer = select(selector.lessThan(0.28), sapphire, select(selector.lessThan(0.54), emerald, select(selector.lessThan(0.74), violet, select(selector.lessThan(0.88), ruby, amber))))
  const middle = mix(sapphire, mix(emerald, ruby, ring), selector.mul(0.7))
  const base = mix(outer, middle, ring.smoothstep(0.25, 0.9))
  return mix(base, mix(gold, amber, selector), ramp(r, 0.11, 0.035))
}
/** A leaded rose window wrapped around the knot. The glass is transmissive, the cames are opaque, and a warm stone core burns inside the tube. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, facing, grazing, intimate} = viewerFrame()
    const metric = tubeMetric(uv())
    const cellQ = vec3(metric.mul(21), 2.3)
    const cells = mx_worley_noise_vec3(cellQ, 1, 0)
    const cellBorder = cells.y.sub(cells.x)
    const cellRandom = cellNoiseVec3(cellQ.floor())
    const voronoiLead = ramp(cellBorder, 0.09, 0.018)
// Large circular roses every 1/7 of the knot, with a ring of petals and a gold heart.
    const phase = metric.x.div(roseSpacing)
    const centre = phase.round()
    const centreWrapped = centre.mod(7)
    const dx = phase.sub(centre).mul(roseSpacing)
    const dy = metric.y.sub(knotCircumference * 0.5)
    const radius = vec2(dx, dy).length()
    const angle = atan(dy, dx.add(1e-6))
    const roseRandom = cellNoiseVec3(vec3(centreWrapped, 4.2, 1.6))
    const innerRose = ramp(radius, roseRadius, roseRadius * 0.9)
    const ringPos = radius.div(ringStep)
    const ringId = ringPos.floor()
    const ringEdge = ringPos.fract()
    const ringLead = ramp(ringEdge.min(ringEdge.oneMinus()), 0.055, 0.012).mul(innerRose)
    const spokePhase = angle.add(roseRandom.x.mul(TAU)).mul(sectors).div(TAU)
    const spokes = ramp(spokePhase.fract().min(spokePhase.fract().oneMinus()), 0.06, 0.015).mul(innerRose).mul(ramp(radius, 0.06, 0.13))
    const rim = ramp(radius.sub(roseRadius * 0.94).abs(), 0.022, 0.004)
    const roseLead = ringLead.max(spokes).max(rim).mul(innerRose)
    const lead = voronoiLead.max(roseLead)
    const glass = lead.oneMinus()
    const paneRandom = cellNoiseVec3(vec3(centreWrapped, ringId, ringPos.fract().mul(11).floor().add(roseRandom.y.mul(9))))
    const selector = mix(cellRandom.x, paneRandom.x, innerRose).add(cellRandom.y.mul(0.12)).fract()
    const ring = radius.div(roseRadius).clamp(0, 1)
    const glassColor = palette(selector, ring, radius)
    const accent = cellRandom.y.smoothstep(0.9, 0.98)
    const glazed = mix(glassColor, color(hsl.integer(87, 77, 85)), accent.mul(0.72))
// A warm interior of rough stone, visible only through the glass.
    const core = new MeshPhysicalNodeMaterial
    core.name = `${knotData.id}_core`
    core.colorNode = color(hsl.integer(50, 37, 6))
    core.emissiveNode = color(hsl.integer(67, 100, 79.4)).mul(mx_noise_float(p.mul(7).add(vec3(0, 0, time.mul(0.11)))).mul(0.12).add(0.94)).mul(1.55)
    core.roughness = 1
    this.coreMaterial = core
    const grisaille = mx_noise_float(vec3(metric.mul(52), 6.2)).mul(0.5).add(0.5).mul(glass).mul(0.16)
    const bubbles = mx_noise_float(vec3(metric.mul(210), time.mul(0.05).add(9.1))).abs().smoothstep(0.04, 0.2).oneMinus().mul(glass).mul(intimate.mul(0.6).add(0.1))
    const surfaceColor = mix(color(hsl.integer(67, 25, 8)), glazed.mul(grisaille.oneMinus()).mul(0.62), glass)
    this.colorNode = surfaceColor
    this.metalnessNode = mix(float(0.82), accent.mul(0.78), glass)
    this.roughnessNode = mix(float(0.32), float(0.055).add(bubbles.mul(0.02)), glass)
    this.transmissionNode = glass.mul(0.88).mul(accent.oneMinus())
    this.thicknessNode = glass.mul(0.035).add(bubbles.mul(0.012)).add(0.01)
    this.attenuationColorNode = glazed
    this.attenuationDistance = 0.28
    this.ior = 1.52
    this.clearcoatNode = glass
    this.clearcoatRoughnessNode = mix(float(0.14), float(0.018), glass)
    this.iridescence = 0.22
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = glass.mul(140).add(facing.mul(260)).add(220)
    const cameHeight = lead.mul(0.0021).add(roseLead.mul(0.0012)).sub(bubbles.mul(0.00035))
    const ripple = mx_noise_float(vec3(metric.mul(42), time.mul(0.04))).mul(glass).mul(0.00022)
    this.normalNode = detailNormal(normalViewGeometry, cameHeight.add(ripple), 1)
    this.aoNode = glass.mul(0.22).add(0.78)
    const candle = mx_noise_float(vec3(time.mul(0.55), 2.7, 1.4)).mul(0.5).add(0.5)
    const innerGlow = glazed.mul(glass).mul(candle.mul(0.5).add(0.35))
    const heart = ramp(radius, 0.08, 0.012).mul(innerRose)
    const leadCatch = color(hsl.integer(85, 100, 90.4)).mul(lead).mul(grazing.pow(2)).mul(0.18)
    const glassSparkle = glints(normalViewGeometry, 1100).mul(glass).mul(accent.mul(0.6).add(0.2)).mul(0.28)
    this.emissiveNode = innerGlow.add(glazed.mul(heart).mul(0.5)).add(leadCatch).add(color(hsl.integer(75, 100, 83)).mul(bubbles).mul(0.35)).add(color(hsl.integer(86, 100, 96.7)).mul(glassSparkle))
    this.envMapIntensity = 0.85
  }
}
