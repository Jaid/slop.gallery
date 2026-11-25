import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, tangentLocal, time, transformNormalToView, vec2, vec3} from 'three/tsl'

import {below} from '../../candidates/claude_opus/lib/below.ts'
import {environmentHighlight, studioSheen} from '../../candidates/claude_opus/lib/environmentHighlight.ts'
import {rgb} from '../../candidates/claude_opus/lib/rgb.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_opus/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Trellis: two helical families of gold bands; integer counts keep the lattice seamless on the knot. */
const trellisAlong = 16
const trellisAround = 3
const enamelIndex = 1.52
/** Raspberry enamel absorbs green and blue; the path length through it sets how deep the red becomes. */
const enamelAbsorption = vec3(0.9, 8.5, 5.6)
/** A Fabergé surface. Gold is engine-turned on a rose engine – sunbursts in some panels, waved barleycorn rings in the others – then flooded with translucent raspberry enamel. The grooves are real analytic facets that steer the reflections, so the pattern flickers and flows as you walk; the enamel deepens toward the limb where the light's path through the glass grows long. A trellis of gold bands with milgrain edges holds a rose-cut diamond at every crossing, and the sunbursts tick like a watch. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const {along, around} = tubeCoordinates()
    const alongDirection = tangentLocal.xyz.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
    const a = along.mul(trellisAlong).add(around.mul(trellisAround))
    const b = along.mul(trellisAlong).sub(around.mul(trellisAround))
    const fa = a.fract().sub(0.5)
    const fb = b.fract().sub(0.5)
// Panel-local physical coordinates (x along the knot, y around the tube), centered in each rhombus.
    const x = fa.add(fb).div(2 * trellisAlong).mul(knotLength)
    const y = fa.sub(fb).div(2 * trellisAround).mul(tubeCircumference)
    const radius = vec2(x, y).length().max(1e-5)
    const angle = y.atan(x)
    const panel = vec2(a.floor(), b.floor())
// Seam-invariant panel identity: a+b is periodic in 2·trellisAlong, a−b in 2·trellisAround.
    const panelSum = panel.x.add(panel.y).mod(2 * trellisAlong)
    const panelDifference = panel.x.sub(panel.y).mod(2 * trellisAround)
    const sunburstPanel = panelSum.mod(2).lessThan(0.5)
// Physical distance to the nearest trellis line: lattice units divided by the lattice gradient's magnitude.
    const latticeGradient = Math.hypot(trellisAlong / knotLength, trellisAround / tubeCircumference)
    const bandDistance = float(0.5).sub(fa.abs()).min(float(0.5).sub(fb.abs())).div(latticeGradient)
// Rose engine: a watch-like tick of the sunbursts, eased so each second settles.
    const tickTime = time.floor().add(time.fract().smoothstep(0, 0.25))
    const tick = tickTime.mul(TAU / 120)
    const rays = 56
    const rings = 520
    const sunburstPhase = angle.add(tick).mul(rays)
    const waveAngle = angle.mul(14).add(tick.mul(-2))
    const ringPhase = radius.mul(rings).add(waveAngle.sin().mul(1.4))
    const phase = sunburstPanel.select(sunburstPhase, ringPhase)
// Analytic groove slope: the gradient of the phase in the panel plane, times the groove's sine profile.
    const radialDirection = vec2(x, y).div(radius)
    const tangentialDirection = vec2(radialDirection.y.negate(), radialDirection.x)
    const sunburstGradient = tangentialDirection.mul(float(rays).div(radius))
    const ringGradient = radialDirection.mul(rings).add(tangentialDirection.mul(waveAngle.cos().mul(1.4 * 14).div(radius)))
    const gradient = sunburstPanel.select(sunburstGradient, ringGradient)
    const phaseFootprint = phase.fwidth()
    const grooveResolved = phaseFootprint.smoothstep(0.35, 1).oneMinus()
// Unit-free groove steepness: deep enough to throw reflections across the room, never beyond ~35°.
    const slope = phase.cos().mul(grooveResolved).mul(0.7)
    const tilt = gradient.normalize().mul(slope)
    const engineNormal = n.sub(alongDirection.mul(tilt.x)).sub(aroundDirection.mul(tilt.y)).normalize()
// Gold bands with milgrain edges, and rose-cut diamonds at the crossings.
    const bandHalfWidth = 0.0075
    const bandFootprint = bandDistance.fwidth().max(1e-5)
    const band = bandDistance.smoothstep(bandHalfWidth - 0.0003, bandHalfWidth).oneMinus()
    const bandEdge = bandDistance.sub(bandHalfWidth * 0.82).abs().smoothstep(0, bandFootprint.add(0.0012)).oneMinus()
    const milgrainPhase = fa.abs().greaterThan(fb.abs()).select(b, a).mul(420)
    const milgrain = milgrainPhase.fract().sub(0.5).abs().smoothstep(0.15, 0.35).oneMinus().mul(bandEdge).mul(milgrainPhase.fwidth().smoothstep(0.4, 0.9).oneMinus())
    const bandProfile = bandDistance.div(bandHalfWidth).clamp().pow2().oneMinus().sqrt()
// Crossing points: where both families meet, measured in physical distance.
    const nearestA = a.round()
    const nearestB = b.round()
    const crossingX = nearestA.add(nearestB).div(2 * trellisAlong).mul(knotLength)
    const crossingY = nearestA.sub(nearestB).div(2 * trellisAround).mul(tubeCircumference)
    const hereX = along.mul(knotLength)
    const hereY = around.mul(tubeCircumference)
    const toCrossing = vec2(hereX.sub(crossingX), hereY.sub(crossingY))
// Wrap the around offset into (−C/2, C/2] so crossings near the tube seam still resolve.
    const wrappedY = toCrossing.y.div(tubeCircumference).add(0.5).fract().sub(0.5).mul(tubeCircumference)
    const crossingVector = vec2(toCrossing.x, wrappedY)
    const crossingDistance = crossingVector.length()
    const diamondRadius = 0.0115
    const diamond = crossingDistance.smoothstep(diamondRadius - 0.0004, diamondRadius + 0.0004).oneMinus()
    const bezel = crossingDistance.smoothstep(diamondRadius + 0.0004, diamondRadius + 0.004).oneMinus().sub(diamond).max(0)
// Rose cut: triangular facets in two rings, each with its own tilt.
    const facetAngle = crossingVector.y.atan(crossingVector.x)
    const facetRing = crossingDistance.div(diamondRadius).step(0.55)
    const facetIndex = facetAngle.div(TAU / 8).add(facetRing.mul(0.5)).floor()
    const facetRandom = cellNoiseVec3(vec3(facetIndex, facetRing, nearestA.add(nearestB).mod(2 * trellisAlong).add(nearestA.sub(nearestB).mod(2 * trellisAround).mul(64))))
    const facetTilt = vec2(facetAngle.cos(), facetAngle.sin()).mul(facetRing.mul(0.45).add(0.25)).add(facetRandom.xy.sub(0.5).mul(0.3))
    const diamondNormal = n.add(alongDirection.mul(facetTilt.x)).add(aroundDirection.mul(facetTilt.y)).normalize()
// Enamel: Beer–Lambert through a thin layer, the path lengthening as the view grazes.
    const cosRefracted = view.dot(n).clamp(0, 1).pow2().oneMinus().div(enamelIndex ** 2).oneMinus().sqrt()
    const enamelDepth = mx_noise_float(positionGeometry.mul(9)).mul(0.08).add(0.22)
    const enamel = enamelAbsorption.mul(enamelDepth).mul(2).div(cosRefracted.max(0.2)).negate().exp()
    const gold = rgb(hsl.integer(77, 100, 81))
    const whiteGold = rgb(hsl.integer(268, 8, 19))
    const underEnamel = gold.mul(enamel)
// Each panel's center is a small polished gold boss, hiding the sunburst's pole.
    const boss = radius.smoothstep(0.0045, 0.0055).oneMinus()
    const metalMask = band.max(bezel).max(diamond).max(boss)
    this.colorNode = mix(mix(underEnamel, gold.mul(bandProfile.mul(0.25).add(0.75)), band.max(bezel).max(boss)), whiteGold, diamond)
    this.metalness = 1
    this.roughnessNode = mix(float(0.1), float(0.13).sub(milgrain.mul(0.06)), band.max(bezel)).mul(diamond.oneMinus()).add(diamond.mul(0.02))
    this.clearcoatNode = metalMask.oneMinus()
    this.clearcoatRoughness = 0.015
    this.clearcoatNormalNode = normalViewGeometry
// Band relief: a rounded wire, tilting toward its edges.
    const bandTilt = bandDistance.div(bandHalfWidth).clamp().mul(0.55).mul(band)
    const bandSide = fa.abs().greaterThan(fb.abs()).select(fb.sign(), fa.sign()).negate()
    const bandNormalDirection = fa.abs().greaterThan(fb.abs()).select(vec2(float(1).div(knotLength / trellisAlong), float(-1).div(tubeCircumference / trellisAround)), vec2(float(1).div(knotLength / trellisAlong), float(1).div(tubeCircumference / trellisAround))).normalize().mul(bandSide)
    const bandNormal = n.add(alongDirection.mul(bandNormalDirection.x.mul(bandTilt))).add(aroundDirection.mul(bandNormalDirection.y.mul(bandTilt))).normalize()
    const bossNormal = n.add(alongDirection.mul(x.div(0.0055).mul(0.6))).add(aroundDirection.mul(y.div(0.0055).mul(0.6))).normalize()
    const surfaceNormal = mix(mix(mix(engineNormal, bossNormal, boss), bandNormal, band.max(bezel)), diamondNormal, diamond).normalize()
    const surfaceNormalView = transformNormalToView(surfaceNormal)
    this.normalNode = surfaceNormalView
// Facets flash on and off as the eye moves: each has a narrow window of view directions in which it catches a light.
    const facetWindow = view.dot(facetRandom.mul(2).sub(1).normalize()).mul(9).add(facetRandom.z.mul(20)).fract().smoothstep(0.6, 0.85).mul(facetRandom.y.mul(0.6).add(0.4))
    const fire = glints(surfaceNormalView, 160).add(facetWindow.mul(1.4)).mul(diamond).mul(near.mul(1.2).add(0.5)).mul(below(facetRandom.z, 0.8))
// Rose-cut stones read as a mosaic of black and blazing facets, with a little spectral fire.
    const dispersion = mix(mix(rgb(hsl.integer(0, 0, 100)), rgb(hsl.integer(244, 100, 82)), facetRandom.x.smoothstep(0.6, 1)), rgb(hsl.integer(340, 99, 87)), facetRandom.y.smoothstep(0.75, 1)).mul(fire)
    const grooveGlint = glints(surfaceNormalView, 140).mul(band.max(diamond).oneMinus()).mul(grooveResolved)
    const shimmer = time.mul(0.6).add(panelSum.mul(TAU * 5 / (2 * trellisAlong))).add(panelDifference.mul(TAU / (2 * trellisAround))).sin().mul(0.2).add(0.8)
// Crisp images of the room's lights: in the gold wire, in the engine-turned floor through the enamel, and split into
// colors by the diamond's facets.
    const goldHighlight = environmentHighlight(environment, surfaceNormal, 0.07).mul(gold).mul(band.max(bezel).max(boss))
    const engineHighlight = environmentHighlight(environment, engineNormal, 0.05).mul(underEnamel).mul(metalMask.oneMinus()).mul(grooveResolved.mul(0.6).add(0.4))
    const diamondHighlight = vec3(environmentHighlight(environment, diamondNormal, 0.02, {offset: vec3(0.035, 0, 0)}).x, environmentHighlight(environment, diamondNormal, 0.02).y, environmentHighlight(environment, diamondNormal, 0.02, {offset: vec3(-0.035, 0, 0)}).z).mul(diamond)
    this.emissiveNode = rgb(hsl.integer(18, 99, 60)).mul(enamel).mul(grooveGlint).mul(0.35).mul(shimmer)
      .add(goldHighlight.mul(0.9))
      .add(gold.mul(studioSheen(surfaceNormal)).mul(band.max(bezel).max(boss)).mul(0.5))
      .add(engineHighlight.mul(1.4).mul(shimmer))
      .add(diamondHighlight.mul(1.5))
      .add(dispersion.mul(2.4))
      .add(rgb(hsl.integer(90, 100, 95.6)).mul(milgrain).mul(glints(normalViewGeometry, 60)).mul(0.15))
      .add(rgb(hsl.integer(18, 90, 16)).mul(grazing.pow(3)).mul(0.1).mul(facing.add(0.2)))
      .add(rgb(hsl.integer(87, 100, 92.3)).mul(intimate).mul(diamond).mul(0.05))
  }
}
