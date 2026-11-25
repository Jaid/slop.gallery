import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../candidates/claude_fable/lib/cellNoiseVec3.ts'
import {debugLayer} from '../../candidates/claude_fable/lib/debugLayer.ts'
import {knotCurve} from '../../candidates/claude_fable/lib/knotCurve.ts'
import {proceduralNormal} from '../../candidates/claude_fable/lib/proceduralNormal.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {TAU} from '../../candidates/claude_fable/lib/TAU.ts'
import {tubeCoordinates, tubeLattice, tubeNoiseCoordinate} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {viewerFrame} from '../../candidates/claude_fable/lib/viewerFrame.ts'
import {wrapCell} from '../../candidates/claude_fable/lib/wrapCell.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

/** Pressed petals: one per lattice cell, an ellipse with a random orientation, a soft edge and a midrib. */
function petals(lattice: Node<'vec2'>, period: Node<'vec2'>, seed: number, keep: number) {
  const cell = wrapCell(lattice.floor(), period)
  const random = cellNoiseVec3(vec3(cell, seed))
  const random2 = cellNoiseVec3(vec3(cell, seed + 5.5))
  const center = random.xy.mul(0.4).add(0.3)
  const offset = lattice.fract().sub(center)
  const angle = random.z.mul(TAU)
  const local = vec2(offset.x.mul(angle.cos()).add(offset.y.mul(angle.sin())), offset.y.mul(angle.cos()).sub(offset.x.mul(angle.sin())))
  const size = random2.x.mul(0.12).add(0.16)
// A petal: an ellipse that is pinched toward one end.
  const taper = local.x.div(size).mul(0.35).add(1)
  const shape = vec2(local.x.div(size), local.y.div(size.mul(0.45)).mul(taper)).length()
  const footprint = shape.fwidth().max(0.002)
  const body = shape.smoothstep(float(1).add(footprint), float(1).sub(footprint.mul(2)))
  const midrib = local.y.abs().smoothstep(0.012, 0.004).mul(shape.smoothstep(1, 0.8))
  const gate = random2.y.smoothstep(1 - keep, 1 - keep + 0.05)
  return {
    body: body.mul(gate),
    midrib: midrib.mul(gate),
    tint: random2.z,
  }
}
/** A paper lantern. Washi over a bamboo frame, lit from inside by a single flame that travels along the knot's core. The paper transmits the flame with real geometry: brightest where the flame is directly behind the sheet as seen by the viewer, dimming with distance and the paper's thickness at grazing angles. Long mulberry fibers, the bamboo ribs and pressed petals all show only in transmission – as shadows that appear when the light passes behind them – while in reflection the paper stays a soft, matte cream with an ink ensō brushed onto one face. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.2)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const {along, around} = tubeCoordinates()
    const t = time
// The flame: a point on the centerline that walks the whole knot every 40 seconds, with a candle's flicker.
    const flamePhase = t.mul(0.025).fract()
    const flamePosition = knotCurve(flamePhase.mul(TAU * 2))
    const flicker = t.mul(11).sin().mul(0.5).add(t.mul(17.3).add(1).sin().mul(0.3)).add(t.mul(3.1).sin().mul(0.2)).mul(0.12).add(1)
    const toFlame = flamePosition.sub(p)
    const flameDistance = toFlame.length()
    const flameDirection = toFlame.div(flameDistance.max(0.001))
// Transmission through the sheet: inverse-square falloff, the sheet must face the flame, and light is forward-scattered
// toward a viewer who looks through the paper at the flame.
    const backlit = flameDirection.dot(n).negate().clamp()
    const forward = flameDirection.dot(view.negate()).mul(0.5).add(0.5).pow(2)
    const thickness = facing.max(0.15).reciprocal()
    const rawTransmission = backlit.mul(float(0.3).div(flameDistance.pow2().add(0.03))).mul(forward.mul(1.2).add(0.4)).mul(thickness.mul(-0.35).exp()).mul(flicker)
// Paper saturates: the hotspot over the flame stays a warm glow instead of burning out to white.
    const transmission = rawTransmission.div(rawTransmission.div(2.2).add(1))
// The flame's afterglow: the paper stays faintly warm along the whole core, so the knot never goes fully dark.
    const ambientGlow = facing.pow(1.5).mul(0.42).add(0.1).mul(t.mul(2.3).sin().mul(0.04).add(1))
// Paper structure: long fibers as ridges of noise, bamboo ribs as rings around the tube, and pressed petals.
    const fiberField = mx_fractal_noise_float(tubeNoiseCoordinate(along, around, 70, 9).add(vec3(0, 0, p.z.mul(4))), 3, 2.3, 0.5)
    const fibers = fiberField.abs().smoothstep(0.06, 0.015).mul(0.35).add(mx_noise_float(p.mul(45)).mul(0.5).add(0.5).mul(0.25))
    const ribCount = 36
    const ribPhase = along.mul(ribCount).add(around)
    const ribFootprint = ribPhase.fwidth().max(0.001)
    const rib = ribPhase.fract().sub(0.5).abs().smoothstep(float(0.03).add(ribFootprint), 0.03).mul(ribFootprint.smoothstep(0.5, 0.15))
    const spine = around.sub(0.25).abs().smoothstep(0.012, 0.006).max(around.sub(0.75).abs().smoothstep(0.012, 0.006))
    const petalLattice = tubeLattice(3)
    const petalA = petals(petalLattice.lattice, petalLattice.period, 1, 0.5)
    const petalB = petals(petalLattice.lattice.add(vec2(0.5, 0.5)), petalLattice.period, 2, 0.4)
    const petalCover = petalA.body.max(petalB.body)
    const petalTint = mix(rgb(hsl.integer(12, 82, 29)), rgb(hsl.integer(42, 78, 50)), petalA.tint.mul(petalA.body).add(petalB.tint.mul(petalB.body)).clamp())
    const midrib = petalA.midrib.max(petalB.midrib)
// Ensō: a single ink circle brushed onto the tube, with the brush running dry toward its end.
    const ensoCenter = vec2(0.5, 0.5)
    const ensoOffset = vec2(along.sub(ensoCenter.x).mul(7.18), around.sub(ensoCenter.y).mul(0.817))
    const ensoRadius = ensoOffset.length()
    const ensoAngle = ensoOffset.y.atan(ensoOffset.x)
    const brushWidth = ensoAngle.add(2.4).sin().mul(0.012).add(0.03)
    const dryBrush = mx_noise_float(vec3(ensoAngle.mul(4), ensoRadius.mul(90), 3)).mul(0.5).add(0.5).smoothstep(ensoAngle.div(TAU).add(0.5).fract().mul(0.9).sub(0.2), ensoAngle.div(TAU).add(0.5).fract().mul(0.9).add(0.1))
    const ensoFootprint = ensoRadius.fwidth().max(0.0005)
    const enso = ensoRadius.sub(0.19).abs().smoothstep(brushWidth.add(ensoFootprint), brushWidth.sub(ensoFootprint)).mul(dryBrush).mul(ensoAngle.div(TAU).add(0.5).fract().smoothstep(0.02, 0.08))
// Optical density of the sheet at this point: paper, fibers, ribs, petals and ink absorb the transmitted light.
// Handmade paper is never even: clouds of pulp thicken and thin the sheet.
    const pulp = mx_fractal_noise_float(p.mul(5.5), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const density = pulp.mul(0.4).add(fibers.mul(0.45)).add(rib.mul(0.7)).add(spine.mul(0.6)).add(petalCover.mul(0.72)).add(midrib.mul(0.2)).add(enso.mul(0.95))
    const throughColor = mix(rgb(hsl.integer(66, 100, 79)), petalTint, petalCover.mul(0.8))
    const light = throughColor.mul(transmission.add(ambientGlow)).mul(density.oneMinus().max(0.02))
// Reflection: matte cream paper with a hint of the fibers, grayed by the ink and the petals where they lie near the surface.
    const cream = rgb(hsl.integer(84, 46, 92.6))
    const surfaceColor = mix(mix(cream.mul(fibers.mul(0.15).add(0.85)), petalTint.mul(0.5).add(cream.mul(0.5)), petalCover.mul(0.35)), rgb(hsl.integer(67, 14, 10)), enso.mul(0.9))
    this.colorNode = surfaceColor.mul(0.4)
    this.metalness = 0
    this.roughnessNode = float(0.85).sub(enso.mul(0.15))
    this.sheen = 0.6
    this.sheenColor.set(hsl.integer(86, 100, 96.4))
    this.sheenRoughness = 0.8
    const surfaceHeight = fibers.mul(0.0006).add(rib.mul(0.0015)).add(petalCover.mul(0.0008)).sub(enso.mul(0.0002))
    this.normalNode = proceduralNormal(surfaceHeight, 1)
// The limb of a backlit lantern glows more than its face; add a soft warm rim that follows the flame.
    const rim = rgb(hsl.integer(71, 100, 85)).mul(grazing.pow(3)).mul(backlit.mul(0.6).add(0.15)).mul(float(0.1).div(flameDistance.add(0.15))).mul(flicker)
    const {emissive, isolated} = debugLayer({
      transmission,
      light,
      density,
      fibers,
      rib,
      petalCover,
      enso,
      rim,
    }, () => light.mul(near.mul(0.3).add(1)).add(rim).add(cream.mul(intimate).mul(0.01)))
    this.emissiveNode = emissive
    if (isolated) {
      this.colorNode = vec3(0)
      this.envMapIntensity = 0
      this.sheen = 0
    }
  }
}
