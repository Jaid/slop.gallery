import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {Break, color, float, Fn, If, Loop, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, refract, step as stepFunction, time, vec3, vec4} from 'three/tsl'

import {surfaceFrame, tubeChord} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const steps = 26
const glassIndex = 1.47
/** Star lattice cells per object unit, and the true radius of a star in object units. */
const starScale = 46
const starRadius = 0.0011
/** Share of its cell a star may wander in, centered, so every star keeps a margin to the cell walls. */
const starJitter = 0.5
/** Distance from a star at which its light, halo included, has fully faded: the margin, so it never leaks into another cell. */
const starReach = (1 - starJitter) / 2 / starScale
/** Cells one march step can cross. A step is at most 0.5 / 26 ≈ 0.019 units long, shorter than one 0.022-unit cell, so it crosses each axis’ cell walls at most once and touches at most four cells. */
const segmentCells = 4
/** Slow drift of the whole cloud. */
const drift = vec3(time.mul(0.011), time.mul(-0.007), time.mul(0.009))
/** Low-frequency fields – domain warp and ionization – that barely change across one chord, so they are sampled at the ends only. */
function largeScale(q: Node<'vec3'>) {
  return vec4(mx_noise_vec3(q.mul(2.6).add(drift)).mul(0.16), mx_noise_float(q.mul(1.9).add(vec3(3.3, 1.1, 9.9))).mul(0.75).add(0.5))
}
/** Emission nebula sampled at an object-space point, given the interpolated large-scale fields. Returns vec4(emitted radiance, extinction coefficient). Hydrogen-alpha filaments, doubly ionized oxygen in the hot cavities, and opaque pillars of dust whose sunlit rims glow brightest – everything slowly churns. */
function nebula(q: Node<'vec3'>, large: Node<'vec4'>) {
  const w = q.add(large.xyz)
  const ionization = large.w
  const filaments = mx_fractal_noise_float(w.mul(7.5).add(drift.mul(2)), 3, 2.05, 0.55).abs().mul(3.2).oneMinus().max(0).pow(3)
  const cloud = mx_noise_float(w.mul(3.1).add(13.7)).mul(0.5).add(0.5).clamp()
  const gas = filaments.mul(cloud.mul(0.8).add(0.35)).add(cloud.pow(4).mul(0.22))
  const dustField = mx_fractal_noise_float(w.mul(5.2).add(vec3(31.3, 7.1, -4.2)), 2, 2.1, 0.5)
  const dust = dustField.smoothstep(0.08, 0.32)
// Ionization fronts: the eroding faces of the pillars, lit by the young stars they shelter.
  const rim = dustField.sub(0.07).abs().smoothstep(0, 0.05).oneMinus().mul(cloud.add(0.3))
  const hydrogen = color(hsl.integer(16, 100, 58.8)).mul(1.25)
  const oxygen = color(hsl.integer(185, 95.5, 75))
  const sulfur = color(hsl.integer(52, 99, 71))
  const tint = mix(mix(hydrogen, sulfur, ionization.smoothstep(0.62, 0.85).mul(0.55)), oxygen, ionization.smoothstep(0.3, 0.48).oneMinus())
  const emission = tint.mul(gas.mul(dust.oneMinus())).mul(2.2).add(color(hsl.integer(66, 100, 87.4)).mul(rim).mul(1.6))
  const extinction = dust.mul(70).add(gas.mul(3))
  return vec4(emission, extinction)
}
/** Point stars whose closest approach to the ray lies within one step’s segment [start, end). The segment walks the star lattice cell by cell (a 3D DDA) and every star’s light fades out within its own cell, so each visible star is found exactly once, wherever the steps happen to fall, and always stays round. The light arrives dimmed by the gas in front of it: `entering` is the transmittance at `start`, `extinction` the segment’s extinction coefficient. */
const stars = Fn(([origin, direction, chord, start, end, entering, extinction, footprint, richness]: [Node<'vec3'>, Node<'vec3'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>, Node<'float'>]) => {
  const light = vec3(0).toVar()
  const q = origin.add(direction.mul(start)).mul(starScale)
  const cell = q.floor().toVar()
  const stride = direction.sign()
  // Object units the ray travels to cross one cell along each axis, and the distance from `start` to the next wall of each axis.
  const crossing = vec3(1).div(direction.abs().max(0.000001).mul(starScale))
  const wall = q.sub(cell)
  const toWall = mix(wall, wall.oneMinus(), stepFunction(0, direction)).mul(crossing).toVar()
  const length = end.sub(start)
  // Sub-pixel stars spread to the pixel footprint while keeping their total energy; the visible spread stays within their own cell.
  const energy = float(starRadius).div(footprint.max(starRadius)).pow2()
  const radius = footprint.clamp(starRadius, starReach * 0.4)
  Loop(segmentCells, () => {
    const random = cellNoiseVec3(cell)
    const identity = cellNoiseVec3(cell.add(vec3(17, 59, 113)))
    const star = cell.add(random.mul(starJitter).add((1 - starJitter) / 2)).div(starScale)
    const toStar = star.sub(origin)
    const along = toStar.dot(direction)
    const miss = toStar.sub(direction.mul(along)).length()
    const inSegment = along.greaterThanEqual(start).and(along.lessThan(end)).select(float(1), float(0))
    // Stars fade out at the glass instead of being sliced by it.
    const inside = along.smoothstep(0, 0.006).mul(chord.sub(along).smoothstep(0, 0.006))
    const transmittance = entering.mul(extinction.mul(along.sub(start).max(0)).negate().exp())
    // Compact support: one at the star, zero with zero slope at its reach.
    const window = miss.div(starReach).pow2().oneMinus().max(0).pow2()
    const brightness = identity.x.smoothstep(richness, 1).pow(2.5).mul(14)
    const twinkle = time.mul(identity.y.mul(3).add(1.2)).add(identity.z.mul(50)).sin().mul(0.22).add(0.88)
    const hue = mix(mix(color(hsl.integer(63, 100, 81)), color(hsl.integer(70, 100, 97)), identity.y.smoothstep(0.2, 0.55)), color(hsl.integer(262, 100, 80)), identity.z.smoothstep(0.55, 0.95))
    const core = miss.div(radius).pow2().negate().exp()
    const halo = miss.div(starReach * 0.45).pow2().negate().exp().mul(0.05)
    light.addAssign(hue.mul(core.add(halo).mul(window).mul(energy).mul(brightness).mul(twinkle).mul(inSegment).mul(inside).mul(transmittance)))
    // Move into whichever neighbor the ray enters first, unless the segment ends before reaching it.
    const next = toWall.x.min(toWall.y).min(toWall.z)
    If(next.greaterThanEqual(length), () => {
      Break()
    })
    If(toWall.x.lessThanEqual(next), () => {
      cell.x.addAssign(stride.x)
      toWall.x.addAssign(crossing.x)
    }).ElseIf(toWall.y.lessThanEqual(next), () => {
      cell.y.addAssign(stride.y)
      toWall.y.addAssign(crossing.y)
    }).Else(() => {
      cell.z.addAssign(stride.z)
      toWall.z.addAssign(crossing.z)
    })
  })
  return light
})
const march = Fn(([origin, direction, chord, footprint, richness]: [Node<'vec3'>, Node<'vec3'>, Node<'float'>, Node<'float'>, Node<'float'>]) => {
  const radiance = vec3(0).toVar()
  const transmittance = float(1).toVar()
  const step = chord.div(steps)
  const entry = largeScale(origin)
  const exit = largeScale(origin.add(direction.mul(chord)))
  Loop(steps, ({i}) => {
    const fraction = float(i).add(0.5).div(steps)
    const center = fraction.mul(chord)
    const sample = nebula(origin.add(direction.mul(center)), mix(entry, exit, fraction))
    const absorbed = sample.w.mul(step).negate().exp().toVar()
// Analytic in-segment integration: emission absorbed by the segment itself.
    const segment = absorbed.oneMinus().div(sample.w.max(0.0001))
    radiance.addAssign(sample.xyz.mul(segment).mul(transmittance))
// Settled before the star walk, whose own loop counter must not capture this one.
    const start = float(i).mul(step).toVar()
    const extinction = sample.w.toVar()
    radiance.addAssign(stars(origin, direction, chord, start, start.add(step), transmittance, extinction, footprint, richness))
    transmittance.mulAssign(absorbed)
// Nothing behind an opaque pillar can reach the eye.
    If(transmittance.lessThan(0.01), () => {
      Break()
    })
  })
  return vec4(radiance, transmittance)
})
/** A crystal tube holding a true volume. Each pixel refracts into the glass and integrates emission and absorption along its own chord through the tube, so pillars of dust occlude the glowing gas behind them and shift against it with every step the viewer takes. Grazing rays travel farther through the cloud and gather more light: the limbs brighten like a nebula’s rim. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, facing, near, intimate} = viewerFrame()
    const {normal, along} = surfaceFrame()
    const direction = refract(view.negate(), normal, 1 / glassIndex).normalize()
    const chord = tubeChord(direction, normal, along, 0.5)
// Approximate object-space pixel size, so distant stars fade by area rather than flickering.
    const footprint = p.fwidth().length().mul(0.6)
// Fainter stars resolve as the viewer approaches.
    const richness = mix(float(0.93), float(0.86), intimate)
    const volume = march(p, direction, chord, footprint, richness)
    const fresnel = facing.oneMinus().pow(5).mul(0.96).add(0.04)
// Newborn suns: a few soft-edged regions breathe as their cores ignite, each on its own slowly varying phase.
    const ignitionSeed = mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5)
    const ignitionPhase = mx_noise_float(p.mul(1.6).add(vec3(7.1, -2.3, 4.9))).mul(9)
    const ignition = time.mul(0.6).add(ignitionPhase).sin().mul(0.5).add(0.5).pow(6).mul(ignitionSeed.smoothstep(0.62, 0.8))
    this.colorNode = color(hsl.integer(282, 42, 2))
    this.metalness = 0
    this.roughness = 0.03
    this.ior = glassIndex
// One glass interface: the clearcoat carries the reflection, so the base layer adds none.
    this.specularIntensity = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.emissiveNode = volume.xyz.mul(fresnel.oneMinus()).mul(ignition.mul(0.35).add(1)).mul(near.mul(0.15).add(0.95))
  }
}
