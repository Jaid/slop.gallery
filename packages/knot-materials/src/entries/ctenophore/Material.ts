import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_noise_float, normalViewGeometry, refract, time, vec3} from 'three/tsl'

import {knotLength, parallaxOffset, surfaceFrame, tubeCircumference, tubeRadius, tubeSpace} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {wavelengthToRgb} from '../../candidates/claude_opus/lib/spectrum.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const combRows = 8
/** Comb plates per row along the whole knot; an integer keeps the rows seamless. */
const platesPerRow = 640
/** Metachronal waves along the knot at any moment, and their beat frequency in hertz. */
const waves = 46
const beatHertz = 1.35
/** Spacing of the cilia that make up each plate, in nanometers – the grating period. */
const ciliaSpacing = 1650
/** Light that the gallery throws at the piece: ceiling lamps, the key light and a low fill, in object space. */
const lamps: Array<[[number, number, number], number]> = [[[0, 1, 0], 1], [[-0.17, 0.49, -0.86], 0.8], [[0.62, 0.25, 0.74], 0.55]]
/** Diffraction of a beating comb plate: grating orders 1–3 for each lamp, aimed by the plate’s tilt. */
function combIridescence(view: Node<'vec3'>, grating: Node<'vec3'>, across: Node<'vec3'>, plateNormal: Node<'vec3'>) {
  let light: Node<'vec3'> = vec3(0)
  for (const [direction, strength] of lamps) {
    const lamp = vec3(...direction).normalize()
    const sine = view.dot(grating).add(lamp.dot(grating)).abs()
// Diffraction stays in the plane of the grating: the across components must mirror each other.
    const plane = view.dot(across).add(lamp.dot(across)).div(0.85).pow2().negate().exp()
    const facing = view.dot(plateNormal).max(0).mul(lamp.dot(plateNormal).max(0)).sqrt()
    let orders: Node<'vec3'> = vec3(0)
    for (const order of [1, 2, 3]) {
      orders = orders.add(wavelengthToRgb(sine.mul(ciliaSpacing / order)).mul(1 / order))
    }
    light = light.add(orders.mul(plane).mul(facing).mul(strength))
  }
  return light
}
/** A comb jelly. Eight rows of ciliary plates beat in metachronal waves that run the length of the knot; each plate is a diffraction grating, so the light of the room breaks into rainbows whose colors depend on the plate’s tilt and on where the viewer stands. Beneath the clear body, true-parallax canals and a glowing core carry the animal’s own blue-green light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {along, around} = tubeSpace()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const {normal, along: alongDirection, around: aroundDirection} = surfaceFrame()
// Comb rows: physical distance across the row and the plate index along it.
    const rowCoordinate = around.mul(combRows).add(0.5)
    const across = rowCoordinate.fract().sub(0.5).mul(tubeCircumference / combRows)
    const rowWidth = 0.0145
    const acrossFootprint = across.fwidth().max(0.00001)
    const row = across.abs().smoothstep(float(rowWidth).sub(acrossFootprint), float(rowWidth).add(acrossFootprint)).oneMinus()
    const platePhase = along.mul(platesPerRow)
    const plateLocal = platePhase.fract()
    const plateFootprint = platePhase.fwidth().max(0.0001)
// Each plate is a paddle: a rounded strip, with the gap between paddles closing as they blur with distance.
    const plateResolved = plateFootprint.smoothstep(0.25, 0.7).oneMinus()
    const paddle = mix(float(0.72), plateLocal.sub(0.5).abs().smoothstep(float(0.36).sub(plateFootprint), float(0.36).add(plateFootprint)).oneMinus(), plateResolved)
    const rowIdentity = rowCoordinate.floor().mod(combRows)
// The metachronal wave: a quick power stroke and a slow recovery, staggered plate by plate.
    const wavePhase = along.mul(waves).sub(time.mul(beatHertz)).add(rowIdentity.mul(0.37)).fract()
    const stroke = wavePhase.smoothstep(0, 0.18).sub(wavePhase.smoothstep(0.18, 1).pow(0.7)).mul(2).sub(1)
    const tilt = stroke.mul(0.95)
    const plateNormal = normal.mul(tilt.cos()).add(alongDirection.mul(tilt.sin()))
    const grating = alongDirection.mul(tilt.cos()).sub(normal.mul(tilt.sin()))
    const rainbow = combIridescence(view, grating, aroundDirection, plateNormal)
// Plates standing up in their stroke catch more light; the whole comb shimmers as each wave passes.
    const lift = stroke.mul(0.5).add(0.5)
    const combLight = rainbow.mul(row).mul(paddle).mul(lift.mul(0.6).add(0.55)).mul(3.2)
// The animal’s own light: blue-green flashes running down the canals beneath the rows, and a glowing core.
    const canalOffset = parallaxOffset(view, normal, 0.024)
    const canalAround = around.add(canalOffset.dot(aroundDirection).div(tubeCircumference))
    const canalAlong = along.add(canalOffset.dot(alongDirection).div(knotLength))
    const canalAcross = canalAround.mul(combRows).add(0.5).fract().sub(0.5).mul(tubeCircumference / combRows)
    const canal = canalAcross.abs().div(0.006).pow2().negate().exp()
    const flashPhase = canalAlong.mul(5).add(time.mul(0.23)).add(canalAround.mul(combRows).add(0.5).floor().mul(0.29)).fract()
    const flash = flashPhase.sub(0.5).div(0.035).pow2().negate().exp().add(flashPhase.sub(0.5).div(0.14).pow2().negate().exp().mul(0.25))
// The core: distance from the refracted view ray to the tube’s centerline, so it sits deep inside from any angle.
    const inward = refract(view.negate(), normal, 1 / 1.34).normalize()
    const skew = inward.cross(alongDirection)
    const coreMiss = normal.mul(tubeRadius).dot(skew.div(skew.length().max(0.0001))).abs()
    const beadPhase = along.mul(TAU * 90).sub(time.mul(2.2))
    const beads = beadPhase.sin().mul(0.5).add(0.5).pow(4)
    const core = coreMiss.div(0.022).pow2().negate().exp().mul(beads.mul(0.75).add(0.25)).add(coreMiss.div(0.06).pow2().negate().exp().mul(0.03))
// Suspended motes drift in the gel; only visible when close.
    const motes = cellularPoints(p.add(parallaxOffset(view, normal, 0.05)).mul(120).add(vec3(0, time.mul(0.15), 0)), 0.02, 0.12, 0.86).mul(intimate)
// Gelatinous body: a faint violet bloom where the gel is seen edge-on, mottled by slow internal currents.
    const current = mx_noise_float(p.mul(6).add(vec3(time.mul(0.05), 0, time.mul(-0.04)))).mul(0.5).add(0.5).clamp()
    const gelRim = grazing.pow(2.4).mul(current.mul(0.4).add(0.6))
    this.colorNode = mix(color('#010204'), color('#040a12'), current).mul(row.oneMinus().mul(0.6).add(0.4))
    this.metalness = 0
    this.roughness = 0.08
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.clearcoatNormalNode = normalViewGeometry
    this.ior = 1.34
    this.specularIntensity = 0.35
    this.sheen = 0.15
    this.sheenColor.set('#7f9cff')
    this.sheenRoughness = 0.5
    const glow = color('#3dffcf').mul(canal.mul(flash).mul(1.6).add(canal.mul(0.06)))
      .add(color('#2f8dff').mul(core).mul(0.4))
      .add(color('#c8f7ff').mul(motes).mul(0.5))
    this.emissiveNode = combLight.mul(near.mul(0.25).add(0.85))
      .add(glow.mul(facing.mul(0.5).add(0.5)))
      .add(color('#6d5cff').mul(gelRim).mul(0.22))
      .add(color('#1b3a7a').mul(current.pow(3)).mul(0.05))
  }
}
