import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, float, mix, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionViewDirection, tangentLocal, tangentView, uv, vec2, vec3} from 'three/tsl'

import {loopPhase} from '../../candidates/claude_sonnet/lib/loopClock.ts'
import {rgb} from '../../candidates/claude_sonnet/lib/rgb.ts'
import {studioLightsView} from '../../candidates/claude_sonnet/lib/studioLights.ts'
import {knotArcLength, knotLength, tubeCircumference} from '../../candidates/claude_sonnet/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Star lattice: cells along the knot and around the tube; both counts are even so every seam and brick offset closes. */
const starAlong = 72
const starAround = 8
const damaskAlong = 144
const damaskAround = 16
const threadPitch = 0.0125
const starPitch = vec2(knotLength / starAlong, tubeCircumference / starAround)
/** Neighbors a star may be sewn to, chosen per star; anything past the last entry means the star is left alone. */
const links = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 1], [2, 1], [1, 2]] as const
/** Distance from a point to a segment, plus the position along it in physical units. */
function segment(point: Node<'vec2'>, from: Node<'vec2'>, to: Node<'vec2'>) {
  const edge = to.sub(from)
  const along = point.sub(from).dot(edge).div(edge.dot(edge).max(1e-12)).clamp()
  const nearest = from.add(edge.mul(along))
  return {
    distance: point.sub(nearest).length(),
    travel: along.mul(edge.length()),
  }
}
/** Kajiya–Kay highlight: light rides a cone around the fiber axis, so a thread lights up in a band that slides as the eye moves. */
function threadShine(axis: Node<'vec3'>, exponent: number) {
  const view = positionViewDirection
  const axisView = axis.dot(view)
  const axisSin = axisView.pow2().oneMinus().max(0).sqrt()
  let sum: Node<'float'> = float(0)
  for (const lamp of studioLightsView) {
    const lampAxis = axis.dot(lamp)
    const lampSin = lampAxis.pow2().oneMinus().max(0).sqrt()
    sum = sum.add(lampAxis.mul(axisView).negate().add(lampSin.mul(axisSin)).clamp(0, 1).pow(exponent))
  }
  return sum
}
/** Midnight velvet brushed in swirling directions – each patch of pile is lightest when seen perpendicular to its fibers, so the cloth blooms and darkens as the viewer walks – woven with a satin damask, and embroidered with a gold-thread constellation joining sequin stars. Thread and satin are shaded as true fibers, so their highlights travel along the stitches. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const p = positionGeometry
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const along = knotArcLength(tube.x)
    const here = vec2(along.mul(starAlong), tube.y.mul(starAround))
    const surface = vec2(along.mul(knotLength), tube.y.mul(tubeCircumference))
    const normal = normalLocal.normalize()
    const tangent = tangentLocal.xyz.normalize()
    const bitangent = normal.cross(tangent).normalize()
// Velvet pile: a smooth direction field, and a brightness that depends on how the fibers lean against the eye.
    const breathe = loopPhase.add(mx_noise_float(p.mul(1.3)).mul(TAU)).sin().mul(0.22)
    const pileAngle = mx_noise_float(p.mul(2.1).add(vec3(3.3, 1.1, -2.7))).mul(Math.PI * 1.4).add(mx_noise_float(p.mul(6.3)).mul(0.5)).add(breathe)
    const pile = tangent.mul(pileAngle.cos()).add(bitangent.mul(pileAngle.sin()))
    const fiber = normal.add(pile.mul(0.9)).normalize()
    const nap = fiber.dot(view).pow2().oneMinus().max(0).sqrt()
    const crush = nap.pow(1.6)
// Satin damask: diamonds of long warp floats laid on a brick grid over a matte ground.
    const damaskRow = along.mul(damaskAlong).add(tube.y.mul(damaskAround).floor().mod(2).mul(0.5))
    const damaskLocal = vec2(damaskRow.fract(), tube.y.mul(damaskAround).fract()).sub(0.5)
    const diamond = damaskLocal.abs().x.add(damaskLocal.abs().y)
    const satin = diamond.smoothstep(0.3, 0.34).oneMinus()
    const satinRim = diamond.sub(0.25).abs().smoothstep(0.012, 0.02).oneMinus()
// Constellations.
    const baseCell = here.floor()
    let starMask: Node<'float'> = float(0)
    let threadMask: Node<'float'> = float(0)
    let stitchPhase: Node<'float'> = float(0)
    let threadAngle: Node<'float'> = float(0)
    let starTint: Node<'float'> = float(0)
    let starRandom: Node<'vec3'> = vec3(0)
    let sequinDistance: Node<'float'> = float(9)
    // Two-cell links can begin outside the nearest-star neighborhood; include their origins or the stitches get cut off.
    for (let i = -2;i <= 2;i++) {
      for (let j = -2;j <= 2;j++) {
        const cell = baseCell.add(vec2(i, j))
        const wrapped = vec3(cell.x.mod(starAlong), cell.y.mod(starAround), 0)
        const random = cellNoiseVec3(wrapped)
        const center = cell.add(random.xy.mul(0.55).add(0.22))
        const pick = random.z.mul(links.length + 2).floor()
        let linkStep: Node<'vec2'> = vec2(0)
        let hasLink: Node<'float'> = float(0)
        for (const [index, link] of links.entries()) {
          const chosen = pick.equal(index)
          linkStep = chosen.select(vec2(link[0], link[1]), linkStep)
          hasLink = chosen.select(float(1), hasLink)
        }
        const neighbor = cell.add(linkStep)
        const neighborWrapped = vec3(neighbor.x.mod(starAlong), neighbor.y.mod(starAround), 0)
        const neighborCenter = neighbor.add(cellNoiseVec3(neighborWrapped).xy.mul(0.55).add(0.22))
        const from = center.mul(starPitch)
        const to = neighborCenter.mul(starPitch)
        const line = segment(here.mul(starPitch), from, to)
        const width = random.x.mul(0.0009).add(0.0021)
        const footprint = line.distance.fwidth().max(1e-5)
        const coverage = line.distance.smoothstep(width, width.add(footprint.mul(1.2))).oneMinus().mul(hasLink).mul(footprint.smoothstep(0.004, 0.012).oneMinus())
        const better = coverage.greaterThan(threadMask)
        stitchPhase = better.select(line.travel, stitchPhase)
        const direction = to.sub(from)
        threadAngle = better.select(direction.y.atan(direction.x), threadAngle)
        threadMask = threadMask.max(coverage)
        const starDistance = here.mul(starPitch).sub(from).length()
        const radius = random.y.mul(0.004).add(0.0075)
        const starFootprint = starDistance.fwidth().max(1e-5)
        const disc = starDistance.smoothstep(radius, radius.add(starFootprint.mul(1.2))).oneMinus().mul(starFootprint.smoothstep(0.004, 0.012).oneMinus())
        const nearer = starDistance.lessThan(sequinDistance)
        starRandom = nearer.select(random, starRandom)
        starTint = nearer.select(random.x, starTint)
        sequinDistance = nearer.select(starDistance, sequinDistance)
        starMask = starMask.max(disc)
      }
    }
// The satin's warp floats run along the knot; the embroidery follows its own stitch direction.
    const warpAxis = tangentView.normalize()
    const cross = vec3(bitangentView as unknown as Node<'vec3'>).normalize()
    const stitchAxis = warpAxis.mul(threadAngle.cos()).add(cross.mul(threadAngle.sin())).normalize()
    const stitchRipple = stitchPhase.mul(1100).sin().mul(0.5).add(0.5)
// Pulses of light run from star to star along the stitches, once per loop.
    const travel = stitchPhase.mul(TAU / 0.05).sub(loopPhase.mul(2)).sin().mul(0.5).add(0.5).pow(4)
    const threadShiny = threadShine(stitchAxis, 26).mul(stitchRipple.mul(0.5).add(0.5)).mul(threadMask).add(travel.mul(threadMask).mul(0.55))
    const satinShiny = threadShine(warpAxis, 14).mul(satin).mul(threadMask.oneMinus()).mul(starMask.oneMinus())
// Weave, resolved only when the threads are.
    const weavePhase = surface.div(threadPitch).mul(TAU)
    const weaveResolved = weavePhase.x.fwidth().smoothstep(0.8, 2.4).oneMinus()
    const weave = weavePhase.x.sin().mul(weavePhase.y.sin()).mul(weaveResolved)
    this.normalNode = proceduralNormal(weave.mul(0.00035).mul(satin.oneMinus().mul(0.7).add(0.3)).add(threadMask.mul(0.0008)).add(starMask.mul(0.001)), 1)
// Sequins: tilted mirror discs. Each has a private facet, so it flashes only when the eye crosses its narrow lobe.
    const tilt = vec2(starRandom.x, starRandom.y).sub(0.5).mul(1.6)
    const facet = normalViewGeometry.add(tangentView.mul(tilt.x)).add(vec3(bitangentView as unknown as Node<'vec3'>).mul(tilt.y)).normalize()
    let sequinShine: Node<'float'> = float(0)
    for (const lamp of studioLightsView) {
      sequinShine = sequinShine.add(facet.dot(lamp.add(positionViewDirection).normalize()).clamp().pow(140))
    }
    const twinkle = loopPhase.add(starRandom.z.mul(TAU)).sin().mul(0.25).add(0.75)
    const gold = rgb(hsl.integer(78, 100, 81.6))
    const paleGold = rgb(hsl.integer(89, 100, 92))
    const sequinColor = mix(mix(paleGold, rgb(hsl.integer(250, 100, 82.5)), starTint.smoothstep(0.62, 0.72)), rgb(hsl.integer(354, 100, 81.6)), starTint.smoothstep(0.9, 0.96))
    const metal = threadMask.max(starMask)
    const velvetBlue = mix(rgb(hsl.integer(273, 70, 5)), rgb(hsl.integer(280, 81, 14)), crush)
    const damaskTone = mix(velvetBlue, mix(rgb(hsl.integer(265, 81, 14.5)), rgb(hsl.integer(290, 68, 25)), crush), satin.mul(0.75))
    const ground = mix(damaskTone, damaskTone.mul(1.5), satinRim.mul(satin))
    this.colorNode = mix(ground, mix(gold, sequinColor, starMask), metal)
    this.metalnessNode = metal
    this.roughnessNode = mix(mix(float(0.88), float(0.5), satin), mix(float(0.32), float(0.12), starMask), metal)
    this.sheen = 1
    this.sheenNode = rgb(hsl.integer(274, 100, 58)).mul(crush.mul(1.3).add(0.15)).mul(metal.oneMinus()).mul(satin.mul(0.6).oneMinus())
    this.sheenRoughness = 0.42
    const dust = cellNoiseVec3(p.mul(70).floor().add(5.5))
    const dustLocal = p.mul(70).fract().sub(dust.mul(0.5).add(0.25)).length()
    const dustFootprint = p.mul(70).fwidth().length().max(0.001)
    const dustStar = dustLocal.smoothstep(0.05, 0.11).oneMinus().mul(dust.x.smoothstep(0.93, 0.96)).mul(dustFootprint.smoothstep(0.3, 1).oneMinus())
    const dustPulse = loopPhase.mul(2).add(dust.z.mul(TAU)).sin().mul(0.4).add(0.6)
    this.emissiveNode = gold.mul(threadShiny).mul(1.5).add(rgb(hsl.integer(296, 100, 79)).mul(satinShiny).mul(0.16))
      .add(sequinColor.mul(sequinShine).mul(starMask).mul(twinkle).mul(2.6))
      .add(sequinColor.mul(starMask).mul(intimate).mul(0.06))
      .add(rgb(hsl.integer(269, 100, 92)).mul(dustStar).mul(dustPulse).mul(0.6).mul(metal.oneMinus()).mul(near.mul(0.6).add(0.4)))
      .add(rgb(hsl.integer(274, 82, 27)).mul(grazing.pow(2)).mul(crush).mul(0.1).mul(facing.add(0.3)))
  }
}
