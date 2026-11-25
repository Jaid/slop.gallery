import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, normalLocal, positionGeometry, tangentLocal, time, vec2, vec3} from 'three/tsl'

import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {haloSegment} from '../../candidates/claude_fable/lib/segmentGlow.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {tubeInterior, tubeRadius} from '../../candidates/claude_fable/lib/tubeInterior.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Candles spaced along the knot's axis, and bamboo rings between them. */
const candleCount = 14
const candleSpacing = knotLength / candleCount
const ribsPerCandle = 2
const strutCount = 6
/** How far the bamboo frame sits beneath the paper, in object units; drives the parallax of its silhouette. */
const frameDepth = 0.012
/** Long mulberry fibers: thin ridges of noise, stretched along three directions and layered. */
function fibers(q: Node<'vec3'>, detail: Node<'float'>) {
  let sum: Node<'float'> = float(0)
  const directions = [vec3(1, 7, 1), vec3(6, 1, 2), vec3(3, 4, 5)]
  for (const [index, stretch] of directions.entries()) {
    const field = mx_noise_float(q.mul(stretch).mul(9).add(index * 13.1))
    sum = sum.add(field.abs().mul(6).oneMinus().max(0))
  }
  const fine = mx_noise_float(q.mul(vec3(2, 30, 3)).mul(6).add(41)).abs().mul(5).oneMinus().max(0)
  return sum.mul(0.33).add(fine.mul(0.5).mul(detail))
}
/** Washi paper over bamboo, lit from inside by a row of candles: the frame's shadow and the flames shift with the view. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const {along, around} = tubeCoordinates()
    const interior = tubeInterior()
    const p = positionGeometry
    const n = normalLocal.normalize()
    const t = tangentLocal.normalize()
    const b = n.cross(t).normalize()
// Paper: mottled pulp thickness and long fibers, both in a surface-aligned frame so they lie flat on the sheet.
    const q = vec3(p.dot(t), p.dot(b), p.dot(n))
    const pulp = mx_noise_float(p.mul(16)).mul(0.5).add(0.5).mul(0.6).add(mx_noise_float(p.mul(55)).mul(0.5).add(0.5).mul(0.4))
    const fiber = fibers(q, near)
    const thickness = pulp.mul(0.6).add(fiber.mul(0.25)).add(0.35)
// Candles: each flame flickers on its own; the viewer's approach stirs the air and the flames with it.
    const candleIndex = along.mul(candleCount).round()
    const candleAlong = candleIndex.div(candleCount).sub(along).mul(knotLength)
    const draft = intimate.mul(0.5).add(1)
    const flicker = (index: Node<'float'>) => {
      const id = index.mod(candleCount)
      const slow = mx_noise_float(vec3(time.mul(2.2).mul(draft), id.mul(3.7), 0)).mul(0.25)
      const fast = mx_noise_float(vec3(time.mul(11).mul(draft), id.mul(1.3).add(9), 2)).mul(0.1).mul(draft)
      return slow.add(fast).add(0.9)
    }
    const flame = flicker(candleIndex)
// Illumination of the paper by its nearest candle: inverse square from the flame on the axis, with the oblique
// incidence far from the candle, so each flame paints a soft pool of light on the paper around it.
    const flameHeight = 0.02
    const reach = tubeRadius - flameHeight
    const candleDistanceSq = candleAlong.pow2().add(reach ** 2)
    const incidence = float(reach).div(candleDistanceSq.sqrt())
    const illumination = flame.mul(0.022).div(candleDistanceSq).mul(incidence.pow(2))
// The flame seen directly through the diffusing sheet: its blurred image slides with the view.
    const start = interior.section(interior.at(float(0)))
    const end = interior.section(interior.at(interior.chord))
    const flameOffset = (section: typeof start) => vec3(section.x.sub(flameHeight * 0.3), section.y, section.along.add(candleAlong))
    const flameImage = haloSegment(flameOffset(start), flameOffset(end), 0.026).mul(interior.chord).mul(flame).mul(thickness.oneMinus().mul(0.6).add(0.4))
// Bamboo frame beneath the paper: rings between candles and six struts along the knot, offset by parallax.
    const ray = tubeRay().mul(frameDepth)
    const frameAlong = along.sub(ray.x)
    const frameAround = around.sub(ray.y)
    const ringPhase = frameAlong.mul(candleCount * ribsPerCandle).add(0.5).fract().sub(0.5).mul(candleSpacing / ribsPerCandle)
    const ring = filteredRibbon(ringPhase, 0.006)
    const strutPhase = frameAround.mul(strutCount).fract().sub(0.5).mul(tubeCircumference / strutCount)
    const strut = filteredRibbon(strutPhase, 0.005)
    const frame = ring.max(strut)
// Ink: an ensō circle brushed on every other candle's span, and a vermilion seal beside it.
    const span = along.mul(candleCount).add(0.5).fract().sub(0.5).mul(candleSpacing)
    const spanIndex = along.mul(candleCount).add(0.5).floor()
    const inkSide = around.sub(0.25).add(0.5).fract().sub(0.5).mul(tubeCircumference)
    const brushNoise = mx_noise_float(p.mul(90)).mul(0.5).add(0.5)
    const ensoRadius = float(0.085).add(mx_noise_float(vec3(span, inkSide, spanIndex).mul(12)).mul(0.006))
    const ensoDistance = vec2(span, inkSide).length().sub(ensoRadius)
    const ensoAngle = inkSide.atan(span)
    const brushWidth = ensoAngle.add(2.2).sin().mul(0.5).add(0.5).mul(0.014).add(0.006)
    const ensoOpen = ensoAngle.sub(2.4).abs().smoothstep(0.12, 0.3)
    const enso = ensoDistance.abs().smoothstep(brushWidth, brushWidth.sub(0.0025)).mul(ensoOpen).mul(brushNoise.smoothstep(0.2, 0.45))
    const sealCenter = vec2(span.sub(0.1), inkSide.add(0.11))
    const sealBox = sealCenter.abs().sub(0.021)
    const sealDistance = sealBox.max(0).length().add(sealBox.x.max(sealBox.y).min(0))
    const seal = sealDistance.smoothstep(0.0015, 0).mul(brushNoise.smoothstep(0.1, 0.3))
    const sealMark = vec2(sealCenter.x.abs().sub(0.011), sealCenter.y.abs().sub(0.011)).length().smoothstep(0.004, 0.003)
    const inkOn = spanIndex.mod(2).lessThan(0.5).select(float(1), float(0))
    const ink = enso.mul(inkOn)
    const vermilion = seal.sub(sealMark).max(0).mul(inkOn)
// Light passing through the sheet: candle glow, dimmed by pulp, blocked by bamboo and by ink.
    const shade = frame.mul(0.8).oneMinus().mul(ink.mul(0.9).oneMinus()).mul(vermilion.mul(0.5).oneMinus())
    const transmitted = illumination.add(flameImage.mul(2.5)).mul(shade).mul(thickness.mul(-1.6).exp())
    const warm = mix(rgb(hsl.integer(48.5, 100, 67.9)), rgb(hsl.integer(83, 100, 86.6)), transmitted.smoothstep(0, 1.2))
    const paper = mix(rgb(hsl.integer(81, 22, 59)), rgb(hsl.integer(83, 22, 73)), fiber.mul(0.6))
    let surface = mix(paper, rgb(hsl.integer(67, 14, 10)), ink.mul(0.92))
    surface = mix(surface, rgb(hsl.integer(32, 94, 48)), vermilion)
    surface = mix(surface, rgb(hsl.integer(68, 40, 25)), frame.mul(facing.mul(0.5).add(0.3)))
    this.colorNode = surface
    this.metalness = 0
    this.roughnessNode = float(0.85).sub(ink.mul(0.2))
    this.sheen = 0.55
    this.sheenColor.set(hsl.integer(86, 100, 96.4))
    this.sheenRoughness = 0.8
    this.normalNode = proceduralNormal(fiber.mul(0.003).add(pulp.mul(0.004)).add(frame.mul(-0.004)), 0.9)
// The sheet glows with what passes through it; at grazing angles the fibers catch the room instead.
    const grazingFibers = rgb(hsl.integer(84, 100, 95.6)).mul(fiber).mul(grazing.pow(3)).mul(0.06)
    const ambientGlow = rgb(hsl.integer(70, 100, 78.6)).mul(0.02).mul(flame)
    this.emissiveNode = warm.mul(transmitted).mul(4).add(ambientGlow).add(grazingFibers)
  }
}
