import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, tangentLocal, time, vec3} from 'three/tsl'

import {below} from '../../candidates/claude_opus/lib/below.ts'
import {rgb} from '../../candidates/claude_opus/lib/rgb.ts'
import {knotLength, loopCoordinate, tubeCoordinates} from '../../candidates/claude_opus/lib/tubeCoordinates.ts'
import {voronoi} from '../../candidates/claude_opus/lib/voronoi3dStruct.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const iceIndex = 1.31
const tubeRadius = 0.13
const marchSteps = 7
/** Feathery barbs: longest near the nucleus, vanishing toward each arm's tip. */
const barbLengthOf = (growth: Node<'float'>, reach: Node<'float'>) => growth.oneMinus().max(0).pow(0.6).mul(0.42).mul(reach)
/** Blackbody-like ramp for the ember: deep red embers, orange flame, a yellow-white heart. */
function flameColor(heat: Node<'float'>) {
  return mix(mix(rgb(hsl.integer(32, 100, 20)), rgb(hsl.integer(35.8, 100, 61.1)), heat.smoothstep(0, 0.45)), rgb(hsl.integer(85, 100, 88.5)), heat.smoothstep(0.45, 1))
}
/** Black ice around a living ember. Stellar frost dendrites – six arms with 60° barbs – grow from scattered nuclei across the surface; the ember inside is ray-marched through the tube along the refracted line of sight. The frost is lit from within, glowing warm where the flame is near. A visitor's body heat melts a window: step close and the crystals recede toward their nuclei, a ring of condensation beads at the thaw line, and the flame shows through clear ice. Step away and it freezes over. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, view, cameraLocal, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const {along} = tubeCoordinates()
    const alongDirection = tangentLocal.xyz.normalize()
    const sideDirection = n.cross(alongDirection).normalize()
// Warmth from the visitor: only surface within reach of their breath thaws.
// Noise erodes the thaw front, so it melts in patches rather than as a clean disc.
    const warmth = p.sub(cameraLocal).length().add(mx_noise_float(p.mul(9)).mul(0.12)).smoothstep(0.95, 1.75).oneMinus()
    const breathing = time.mul(0.7).sin().mul(0.04)
    const thaw = warmth.add(breathing.mul(warmth)).clamp()
// Stellar dendrites, one per Voronoi nucleus, in the local tangent plane.
    const crystalScale = 4.6
    const nuclei = voronoi(p.mul(crystalScale), 0.85)
    const offset = nuclei.toFeature.negate()
    const planeX = offset.dot(alongDirection)
    const planeY = offset.dot(sideDirection)
    const rotation = nuclei.random.x.mul(TAU)
// A slight curl of the growth field keeps arms from being ruler-straight.
    const angle = planeY.atan(planeX).sub(rotation).add(mx_noise_float(p.mul(40)).mul(0.12))
    const radius = vec3(planeX, planeY, 0).length()
    const sector = angle.add(Math.PI / 6).mod(Math.PI / 3).sub(Math.PI / 6)
    const armIndex = angle.add(Math.PI / 6).div(Math.PI / 3).floor().mod(6)
// Frost ferns: one or two arms race ahead, the rest stay stubs.
    const armLength = mx_noise_float(vec3(armIndex.mul(1.7), nuclei.random.x.mul(40), 3.3)).mul(0.5).add(0.5).pow(2.2).mul(1.9).add(0.25)
    const armAlong = radius.mul(sector.cos())
    const armAcross = radius.mul(sector.sin()).abs()
// Crystals shrink back toward their nuclei as the ice warms, and breathe a little on their own.
    const seeded = below(nuclei.random.z, 0.82)
// Arms stop short of their cell's wall, so no crystal is ever sliced by a neighbor's territory.
    const reach = nuclei.random.y.mul(0.1).add(0.24).mul(armLength).min(0.44).mul(seeded).mul(thaw.oneMinus().pow(1.5)).mul(time.mul(0.25).add(nuclei.random.z.mul(TAU)).sin().mul(0.03).add(1))
    const growth = armAlong.div(reach.max(0.001))
    const footprint = vec3(planeX, planeY, 0).fwidth().length().max(0.0005)
    const armWidth = growth.oneMinus().max(0).pow(1.2).mul(0.026).add(0.003)
    const arm = armAcross.smoothstep(armWidth.sub(footprint), armWidth.add(footprint)).oneMinus().mul(below(growth, 1))
    const barbPhase = armAlong.sub(armAcross.mul(0.57735)).mul(40)
    const barbWidth = armAcross.div(barbLengthOf(growth, reach).max(0.001)).oneMinus().max(0).mul(0.16).add(0.04)
    const barbLength = barbLengthOf(growth, reach)
    const barbFootprint = barbPhase.fwidth().max(0.001)
    const barb = barbPhase.fract().sub(0.5).abs().smoothstep(barbWidth.sub(barbFootprint), barbWidth.add(barbFootprint)).oneMinus()
      .mul(armAcross.lessThan(barbLength).select(float(1), float(0))).mul(below(growth, 1)).mul(barbFootprint.smoothstep(0.3, 0.8).oneMinus())
    const nucleus = radius.smoothstep(0.015, 0.045).oneMinus().mul(thaw.oneMinus()).mul(seeded)
// Crystals are thin and glassy: dense along the spine, translucent in the barbs.
    const dendrite = arm.mul(0.9).max(barb.mul(0.62)).max(nucleus.mul(0.8)).mul(nuclei.border.smoothstep(0, 0.06))
// Fine rime between the stars, thinning where the visitor's warmth reaches.
    const rimeCoordinate = p.mul(140)
    const rime = mx_fractal_noise_float(rimeCoordinate, 2, 2, 0.5).mul(0.5).add(0.5).smoothstep(0.45, 0.75).mul(rimeCoordinate.fwidth().length().smoothstep(0.5, 1.2).oneMinus().mul(0.6).add(0.4))
    const rimeCover = mx_noise_float(p.mul(3.3)).mul(0.5).add(0.5).smoothstep(0.25, 0.65).mul(thaw.oneMinus())
    const frost = dendrite.max(rime.mul(rimeCover).mul(0.2)).clamp()
// Condensation beads along the thaw line.
    const dew = voronoi(p.mul(95), 0.8)
    const dewBand = thaw.sub(0.45).abs().smoothstep(0.1, 0.3).oneMinus()
    const bead = dew.distance.smoothstep(0.18, 0.3).oneMinus().mul(below(dew.random.x, 0.55)).mul(dewBand).mul(p.mul(95).fwidth().length().smoothstep(0.4, 1).oneMinus())
// The ember: march the refracted ray through the tube and integrate flame density around the centerline.
    const center = p.sub(n.mul(tubeRadius))
    const cosIncident = n.dot(view).clamp(0, 1)
    const lateral = view.sub(n.mul(cosIncident))
    const refractedCos = lateral.dot(lateral).div(iceIndex ** 2).oneMinus().max(0.05).sqrt()
    const inward = n.mul(refractedCos).add(lateral.div(iceIndex)).negate().normalize()
    const chord = refractedCos.mul(tubeRadius * 2)
    let glow: Node<'vec3'> = vec3(0)
    let transmittance: Node<'float'> = float(1)
    for (let i = 0;i < marchSteps;i++) {
      const t = chord.mul((i + 0.5) / marchSteps)
      const sample = p.add(inward.mul(t))
      const fromCenter = sample.sub(center)
      const radial = fromCenter.sub(alongDirection.mul(fromCenter.dot(alongDirection))).length()
// Flame tongues lick along the knot; turbulence rises through them.
      const lickLoop = loopCoordinate(along.sub(time.mul(1.1 / (knotLength * 9))), knotLength * 9)
      const lick = mx_noise_float(vec3(lickLoop.x.add(sample.y.mul(14)), lickLoop.y, sample.z.mul(14).add(time.mul(0.6))))
      const flickerLoop = loopCoordinate(along, knotLength * 2.5)
      const flicker = mx_noise_float(vec3(flickerLoop.x, flickerLoop.y.add(i * 0.37), time.mul(0.9))).mul(0.5).add(0.75)
      const width = lick.mul(0.018).add(0.042).mul(flicker)
      const density = radial.div(width).pow2().negate().exp().mul(flicker)
      const heat = radial.div(width).pow2().negate().mul(1.6).exp().mul(flicker.clamp(0, 1))
      glow = glow.add(flameColor(heat).mul(density).mul(transmittance))
      transmittance = transmittance.mul(density.mul(0.22).oneMinus().clamp())
    }
    const ember = glow.mul(3.2 / marchSteps)
    const emberLevel = ember.dot(vec3(0.3, 0.5, 0.2))
// Air bubbles frozen at two depths catch the ember's light and drift apart with parallax.
    let bubbles: Node<'float'> = float(0)
    for (const [depth, scale] of [[0.025, 38], [0.06, 24]] as const) {
      const q = p.add(inward.mul(refractedCos.max(0.3).reciprocal().mul(depth))).mul(scale)
      const cells = voronoi(q, 0.8)
      const size = cells.random.y.mul(0.1).add(0.06)
      const ringEdge = cells.distance.sub(size).abs().smoothstep(0, q.fwidth().length().mul(0.8).add(0.02)).oneMinus()
      bubbles = bubbles.add(ringEdge.mul(below(cells.random.x, 0.18)).mul(q.fwidth().length().smoothstep(0.3, 0.8).oneMinus()))
    }
// Frost scatters: it veils the ember but glows with its light, strongest right above the flame.
    const frostVeil = frost.mul(0.92)
    const frostColor = mix(rgb(hsl.integer(252, 37, 81)), rgb(hsl.integer(257, 100, 96)), dendrite)
    const iceColor = mix(rgb(hsl.integer(257, 56, 3)), rgb(hsl.integer(253, 50, 8)), grazing)
    this.colorNode = mix(iceColor, frostColor, frost)
    this.metalness = 0
    this.roughnessNode = mix(float(0.04), float(0.75), frost)
    this.clearcoatNode = frost.oneMinus().mul(0.9).add(bead)
    this.clearcoatRoughness = 0.02
    this.clearcoatNormalNode = normalViewGeometry
    this.normalNode = proceduralNormal(dendrite.mul(0.6).add(rime.mul(rimeCover).mul(0.25)).add(bead.mul(0.8)), 0.0012)
    const crystalNormal = normalViewGeometry.add(vec3(nuclei.random.sub(0.5)).mul(0.6)).normalize()
    const sparkle = glints(crystalNormal, 300).mul(dendrite).mul(near.mul(0.7).add(0.3))
    this.emissiveNode = ember.mul(frostVeil.oneMinus()).mul(intimate.mul(0.5).add(0.8))
      .add(flameColor(float(0.4)).mul(emberLevel.mul(1.3).add(0.05)).mul(frost).mul(facing.mul(0.6).add(0.4)))
      .add(rgb(hsl.integer(0, 0, 100)).mul(sparkle).mul(0.6))
      .add(rgb(hsl.integer(61, 100, 79)).mul(bead).mul(emberLevel.mul(0.8).add(0.1)))
      .add(flameColor(float(0.6)).mul(bubbles).mul(emberLevel.mul(0.9).add(0.08)).mul(frostVeil.oneMinus()))
      .add(rgb(hsl.integer(253, 100, 71)).mul(grazing.pow(4)).mul(frost.oneMinus()).mul(0.08))
  }
}
