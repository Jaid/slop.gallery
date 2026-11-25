import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_fractal_noise_float, mx_noise_float, refract, time, uv, vec3} from 'three/tsl'

import {gratingSpectrum} from '../../candidates/claude_opus/lib/diffraction.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameSurface.ts'
import {localDirection} from '../../candidates/claude_opus/lib/localDirection.ts'
import {knotCircumference, knotLength, knotTubeRadius, tubeMetric, tubeTurns} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Eight comb rows, each spiraling three times around the tube over the whole knot; whole numbers keep both UV seams closed. */
const rows = 8
const winding = 3
const plates = 420
/** Plates per metachronal wavelength and waves per second. */
const waveLength = 14
const beatRate = 0.85
const jellyIndex = 1.34
/** Comb half-width in row units (one row unit is an eighth of the circumference). */
const combHalfWidth = 0.13
/** Rows on the far side of the body, seen through the gelatin. Returns a soft band mask and the row’s beat phase. */
function farRows(rowCoord: Node<'float'>, s: Node<'float'>) {
  const across = rowCoord.fract().sub(0.5).abs()
  const band = across.smoothstep(0.05, 0.2).oneMinus()
  const phase = s.mul(plates / waveLength).sub(time.mul(beatRate)).add(rowCoord.floor().mul(0.37))
  return {
    band,
    phase,
  }
}
/**
 * Comb jelly. Rows of fused cilia (comb plates) beat in metachronal waves; every plate is a diffraction grating that
 * tilts as it beats, so a torch held by the viewer splits into rainbows that run along the rows. The gelatin is lit
 * from within by a red gut canal on the centerline and, when the viewer comes close, by pulses of blue bioluminescence.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, intimate, near} = viewerFrame()
    const frame = knotFrame(tube)
    const n = frame.normal
    const s = tubeMetric(tube).x.div(knotLength)
    const turns = tubeTurns(tube)
// Unit direction of a comb row on the surface: along the knot, drifting around it with the spiral.
    const rowDirection = frame.along.sub(frame.around.mul(winding * knotCircumference / knotLength)).normalize()
    const sideways = n.cross(rowDirection)
    const rowCoord = turns.add(s.mul(winding)).mul(rows)
    const rowIndex = rowCoord.floor().mod(rows)
    const across = rowCoord.fract().sub(0.5)
    const rowFootprint = rowCoord.fwidth().max(0.0001)
    const band = across.abs().smoothstep(combHalfWidth, rowFootprint.add(combHalfWidth)).oneMinus()
// Comb plates: short paddles stacked along the row, separated by narrow gaps.
    const plateCoord = s.mul(plates)
    const plateFootprint = plateCoord.fwidth().max(0.0001)
    const plateResolved = plateFootprint.smoothstep(0.25, 0.6).oneMinus()
    const plateLocal = plateCoord.fract().sub(0.5).abs()
    const plateBody = plateLocal.smoothstep(0.42, plateFootprint.add(0.42)).oneMinus()
    const plate = mix(float(0.84), plateBody, plateResolved)
// Metachronal beat: a fast power stroke and a slow recovery, phase-shifted plate by plate.
    const phase = plateCoord.div(waveLength).sub(time.mul(beatRate)).add(rowIndex.mul(0.37))
    const angle = phase.mul(TAU)
    const tilt = angle.add(angle.sin().mul(0.75)).sin().mul(0.62)
    const plateNormal = n.mul(tilt.cos()).sub(rowDirection.mul(tilt.sin()))
    const grating = rowDirection.mul(tilt.cos()).add(n.mul(tilt.sin()))
// Cilia spacing differs a little between rows, so neighboring rows never flash in unison.
    const spacing = cellNoiseVec3(vec3(rowIndex, 3.7, 1.3)).x.mul(260).add(980)
// The viewer’s own torch, held a little above the eye, and two fixed gallery lights.
    const torch = view.add(localDirection([0, 1, 0]).mul(0.28)).normalize()
    const lights = [{
      direction: torch,
      strength: 1.25,
    }, {
      direction: localDirection([-3, 9, -16]),
      strength: 0.7,
    }, {
      direction: localDirection([0.6, 1, 0.5]),
      strength: 0.5,
    }]
    let rainbow: Node<'vec3'> = vec3(0)
    let mirror: Node<'float'> = float(0)
    for (const light of lights) {
      const half = light.direction.add(view)
      const shift = half.dot(grating)
// Light outside the plane of the grating vector spreads out quickly.
      const lobe = half.dot(sideways).pow2().mul(-3.2).exp()
      const lit = light.direction.dot(plateNormal).smoothstep(-0.05, 0.25).mul(view.dot(plateNormal).smoothstep(-0.05, 0.2))
      rainbow = rainbow.add(gratingSpectrum(shift, spacing).mul(lobe).mul(lit).mul(light.strength))
      mirror = mirror.add(shift.pow2().mul(-260).exp().mul(lobe).mul(lit).mul(light.strength))
    }
    const combGlow = band.mul(plate)
// Tracts of fine cilia, visible when the visitor leans in.
    const ciliaCoord = across.mul(rows * 34)
    const cilia = ciliaCoord.mul(TAU).sin().mul(0.5).add(0.5).mul(ciliaCoord.fwidth().smoothstep(0.3, 0.9).oneMinus())
    const comb = rainbow.mul(cilia.mul(0.35).add(0.75)).add(vec3(0.9, 0.97, 1).mul(mirror).mul(0.6)).mul(combGlow)
// Refracted view ray through the round body: closest approach to the gut canal on the centerline and the far wall it reaches.
    const inward = refract(view.negate(), n, float(1 / jellyIndex)).normalize()
    const lateral = inward.sub(frame.along.mul(inward.dot(frame.along)))
    const lateralLength = lateral.length().max(0.05)
    const lateralDirection = lateral.div(lateralLength)
    const approach = n.cross(lateralDirection).length().mul(knotTubeRadius)
    const depthCos = lateralDirection.dot(n).negate().max(0)
    const chord = depthCos.mul(2 * knotTubeRadius).div(lateralLength)
// Where the ray meets the far wall: rotated around the tube by the chord’s central angle, and shifted along it.
    const farNormal = n.add(lateralDirection.mul(depthCos.mul(2)))
    const farOffset = atan(farNormal.dot(frame.around), farNormal.dot(n))
    const farS = s.add(inward.dot(frame.along).mul(chord).div(knotLength))
    const farRowCoord = turns.add(farOffset.div(TAU)).add(farS.mul(winding)).mul(rows)
    const behind = farRows(farRowCoord, farS)
    const farRainbow = gratingSpectrum(behind.phase.mul(TAU).sin().mul(0.25).add(0.62), spacing, 2)
// Gut canal: a ruddy core that glows where the line of sight passes nearest the centerline.
    const gutWobble = mx_noise_float(p.mul(9).add(vec3(0, 0, time.mul(0.12)))).mul(0.006)
    const gut = approach.sub(gutWobble).div(0.013).pow2().negate().exp()
    const gutPulse = s.mul(TAU * 18).sub(time.mul(1.4)).sin().mul(0.2).add(0.8)
// Meridional canals beneath the rows carry photocytes; a startled jelly sends light racing along them.
    const canal = across.abs().smoothstep(0.035, rowFootprint.mul(1.5).add(0.05)).oneMinus()
    const canalTrack = s.mul(5).add(rowIndex.mul(0.23)).sub(time.mul(0.22))
    const flash = canalTrack.fract().sub(0.5).abs().mul(2).oneMinus().pow(14)
    const photocytes = cellNoiseVec3(vec3(rowIndex, plateCoord.floor(), 7.1)).x.smoothstep(0.55, 0.95).mul(plateResolved).mul(0.6).add(0.4)
    const startle = intimate.mul(0.85).add(near.mul(0.25)).add(0.06)
// Drifting specks of marine snow caught inside the gelatin.
    const snowField = mx_fractal_noise_float(p.mul(28).sub(inward.mul(0.06)).add(vec3(0, time.mul(-0.02), 0)), 2, 2, 0.5)
    const snow = snowField.smoothstep(0.42, 0.62).mul(snowField.fwidth().smoothstep(0.15, 0.45).oneMinus()).mul(0.08)
// Gel undulation and raised combs for the wet surface highlights.
    const undulation = mx_noise_float(p.mul(14).add(vec3(time.mul(0.05), 0, 0))).mul(0.0009)
    this.normalNode = proceduralNormal(band.mul(0.0024).add(combGlow.mul(plateResolved).mul(0.0008)).add(undulation), 1)
    this.colorNode = mix(color(hsl.integer(251, 60, 5)), color(hsl.integer(244, 63, 14)), band.mul(0.6))
    this.metalness = 0
    this.roughness = 0.32
    this.specularIntensity = 0.6
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.clearcoatNormalNode = proceduralNormal(undulation, 1)
    const scatter = chord.div(2 * knotTubeRadius).clamp()
    const body = color(hsl.integer(252, 78, 15)).mul(scatter.mul(0.16).add(0.025)).add(color(hsl.integer(241, 100, 69.4)).mul(grazing.pow(4)).mul(0.32))
    const interior = color(hsl.integer(33, 100, 63.6)).mul(gut).mul(gutPulse).mul(facing.mul(0.5).add(0.25)).mul(0.16)
      .add(farRainbow.mul(behind.band).mul(0.22).mul(scatter))
      .add(color(hsl.integer(230, 100, 90)).mul(snow))
    const light = color(hsl.integer(228, 100, 74)).mul(canal.mul(flash).mul(photocytes)).mul(startle).mul(1.6)
      .add(color(hsl.integer(227, 93, 43)).mul(canal).mul(0.05))
    this.emissiveNode = body.add(interior).add(light).add(comb.mul(near.mul(0.4).add(1.1)))
  }
}
