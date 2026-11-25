import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {environmentRadiance} from '../../candidates/claude_opus/lib/environmentRadiance.ts'
import {coverage, pixelFootprint} from '../../candidates/claude_opus/lib/footprint.ts'
import {knotArc, knotCircumference, knotLength} from '../../candidates/claude_opus/lib/knotArc.ts'
import {tubeRelief} from '../../candidates/claude_opus/lib/tubeRelief.ts'
import {voronoi} from '../../candidates/claude_opus/lib/voronoi2d.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** medallion bays along and around the tube */
const bays: [number, number] = [18, 2]
/** glass pieces along and around the tube */
const pieces: [number, number] = [108, 12]
const bayLength = knotLength / bays[0]
const pieceLength = knotLength / pieces[0]
/** Pick a glass by cumulative share; arithmetic rather than select() keeps shared nodes stage-safe. */
function palette(pick: Node<'float'>, entries: Array<[number, Node<'vec3'>]>, last: Node<'vec3'>) {
  let result = last
  for (const [threshold, glass] of entries.toReversed()) {
    result = mix(glass, result, pick.step(threshold))
  }
  return result
}
/** Window layout at a tube coordinate, as signed distances in object units (negative inside lead). */
function tracery(tube: Node<'vec2'>) {
  const arc = vec2(knotArc(tube.x), tube.y)
  const bay = arc.mul(vec2(...bays))
  const local = bay.fract().sub(0.5)
  const radius = local.length()
  const angle = atan(local.y, local.x)
  const parity = bay.x.floor().add(bay.y.floor()).mod(2)
// Chartres alternates round medallions with quatrefoils
  const circle = radius.sub(0.35)
  const quatrefoil = radius.sub(angle.mul(4).cos().mul(0.075).add(0.285))
  const medallion = mix(circle, quatrefoil, parity)
  const pearlBand = medallion.sub(0.028)
  const pearlCount = 26
  const pearlAround = angle.div(TAU).mul(pearlCount).add(0.5).fract().sub(0.5).mul(radius.mul(TAU / pearlCount))
  const pearl = vec2(pearlBand, pearlAround).length().sub(0.016)
  const glass = voronoi(arc.mul(vec2(...pieces)), pieces, {
    jitter: 0.85,
    seed: 7,
  })
  const came = glass.border.mul(pieceLength).sub(0.0031)
  const ring = medallion.abs().min(medallion.sub(0.056).abs()).mul(bayLength).sub(0.0034)
// saddle bars ring the tube between bays; lengthwise bars would read as seams
  const iron = float(0.5).sub(local.x.abs()).mul(bayLength).sub(0.0042)
  const lead = came.min(ring).min(iron)
// grisaille: a painted rosette traced over the medallion glass
  const petals = radius.sub(angle.mul(4).add(Math.PI / 4).cos().abs().mul(0.17).add(0.03)).abs()
  const rings = radius.sub(0.215).abs().min(radius.sub(0.06).abs())
  const grisaille = petals.min(rings).mul(bayLength).sub(0.0011).min(radius.sub(0.028).mul(bayLength))
  return {
    grisaille,
    iron,
    arc,
    glass,
    lead,
    medallion,
    pearl: pearl.mul(bayLength),
    pearlBand,
  }
}
/** Medieval stained glass. Leaded mosaics of cobalt and ruby fill alternating medallions ringed with pearl borders and held by iron armatures. Each pane glows with the light standing behind it from the viewer's position — gallery lights and a slow, circling sun — refracted a little differently by every hand-blown sheet, so walking past sets the window flickering pane by pane. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const tube = uv()
    const {view, facing, objectDistance} = viewerFrame()
    const near = objectDistance.smoothstep(1, 2.6).oneMinus()
    const layout = tracery(tube)
    const identity = layout.glass.identity
    const inside = layout.medallion.step(0).oneMinus()
    const pick = identity.x
    const cobalt = vec3(0.012, 0.07, 0.62)
    const ruby = vec3(0.62, 0.008, 0.03)
    const gold = vec3(0.95, 0.5, 0.04)
    const emerald = vec3(0.02, 0.42, 0.1)
    const violet = vec3(0.24, 0.04, 0.48)
    const pale = vec3(0.85, 0.8, 0.6)
    const background = palette(pick, [[0.66, cobalt], [0.8, ruby], [0.9, violet]], gold)
    const figure = palette(pick, [[0.42, ruby], [0.62, gold], [0.78, emerald], [0.9, cobalt]], pale)
    const pearlGlass = layout.pearl.step(0).oneMinus()
    const tint = mix(mix(background, figure, inside), pale, pearlGlass)
// hand-blown sheets vary in density and carry streaks and seeds
    const density = identity.y.mul(0.7).add(0.65)
    const streakAngle = identity.z.mul(TAU)
    const streakAxis = vec2(streakAngle.cos(), streakAngle.sin())
    const streak = mx_noise_float(vec3(layout.arc.mul(vec2(knotLength, knotCircumference)).dot(streakAxis).mul(90), layout.arc.mul(vec2(knotLength, knotCircumference)).dot(vec2(streakAxis.y, streakAxis.x.negate())).mul(9), identity.x.mul(40)))
    const seeds = cellularPoints(vec3(layout.arc.mul(vec2(knotLength, knotCircumference)).mul(260), identity.y.mul(30)), 0.03, 0.12, 0.8).mul(near)
    const transmittance = tint.pow(density).mul(streak.mul(0.18).add(1))
// every sheet refracts the light behind it a little differently
    const wobble = cellNoiseVec3(vec3(layout.glass.cell, 3.7)).sub(0.5).mul(0.5)
    const behind = view.negate().add(wobble).normalize()
    const sunAngle = time.mul(0.11)
    const sun = vec3(sunAngle.cos(), float(0.32), sunAngle.sin()).normalize()
    const sunAlignment = behind.dot(sun).max(0)
    const sunlight = sunAlignment.pow(40).mul(6).add(sunAlignment.pow(6).mul(1.6)).add(sunAlignment.pow(1.5).mul(0.5))
    const daylight = environmentRadiance(environment, behind, 0.5).mul(0.45).add(0.12)
    const pixel = pixelFootprint().balanced
    const leadCover = coverage(layout.lead, pixel)
    const paintCover = coverage(layout.grisaille, pixel).mul(inside).mul(pearlGlass.oneMinus())
    const ironCover = coverage(layout.iron, pixel)
    const lit = transmittance.mul(paintCover.mul(-0.9).add(1)).mul(daylight.add(sunlight)).mul(2.1).mul(seeds.mul(0.8).add(1)).mul(facing.mul(0.5).add(0.5))
// halation: light bleeding from each pane over the edge of the lead that holds it
    const halation = layout.lead.negate().div(0.0016).clamp().oneMinus().pow(2).mul(0.45).mul(ironCover.oneMinus())
    const glow = lit.mul(leadCover.oneMinus().add(leadCover.mul(halation)))
    const relief = tubeRelief(at => {
      const l = tracery(at)
      const profile = l.lead.negate().div(0.0034).clamp().sqrt().mul(0.0028)
      const tiltSeed = cellNoiseVec3(vec3(l.glass.cell, 9.1)).sub(0.5)
      const pane = l.glass.distance.mul(tiltSeed.x.add(tiltSeed.y)).mul(0.005)
      return profile.add(pane)
    })
    const surface = layout.arc.mul(vec2(knotLength, knotCircumference))
    const patina = mx_noise_float(vec3(surface.mul(60), 0)).mul(0.5).add(0.5)
    const lead = mix(mix(color(hsl.integer(264, 5, 12)), color(hsl.integer(248, 5, 26)), patina), color(hsl.integer(68, 3, 10)), ironCover.mul(0.6))
    this.normalNode = relief.viewNormal
    this.colorNode = mix(mix(transmittance.mul(0.015), color(hsl.integer(53, 40, 13)), paintCover.mul(0.6)), lead, leadCover)
    this.metalnessNode = leadCover.mul(ironCover.mul(-0.3).add(0.6))
    this.roughnessNode = mix(float(0.07).add(paintCover.mul(0.3)), patina.mul(0.25).add(0.45).add(ironCover.mul(0.2)), leadCover)
    this.specularIntensity = 0.6
    this.emissiveNode = glow
  }
}
