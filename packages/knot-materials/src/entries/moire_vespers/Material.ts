import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, cos, dot, float, mix, mx_noise_float, select, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Arc length of the exhibition knot's centerline, in world units per full lap of the tube parameter. */
const knotLapLength = 7.177185
/** Circumference of the knot tube. */
const knotCircumference = TAU * 0.13
type SealLattice = {
  /** Angle around the heart of the nearest seal. */
  angle: Node<'float'>
  /** Distance from the heart of the nearest seal, in cell units. */
  distance: Node<'float'>
  /** Per-seal identity: the same seal never repeats. */
  random: Node<'vec3'>
}

/** A staggered lattice of wax seals, wrapped once around the tube and once along it. */
function sealLattice(tube: Node<'vec2'>, {columns, rows, seed}: {
  columns: number
  rows: number
  seed: number
}): SealLattice {
  const q = vec2(tube.x.mul(columns), tube.y.mul(rows))
  const first = q.sub(vec2(0.5, 0.25)).mod(vec2(1, 0.5)).sub(vec2(0.5, 0.25))
  const second = q.sub(vec2(0.5, 0.25)).sub(vec2(0.5, 0.25)).mod(vec2(1, 0.5)).sub(vec2(0.5, 0.25))
  const nearer = select(first.dot(first).lessThan(second.dot(second)), first, second)
  const site = q.sub(nearer).mod(vec2(columns, rows))
  // Seals are round in world units even though the tube is a long strip.
  const squash = knotLapLength * rows / (knotCircumference * columns)
  const world = vec2(nearer.x.mul(squash), nearer.y)
  return {
    angle: atan(world.y, world.x),
    distance: world.length(),
    random: cellNoiseVec3(vec2(site.x.mul(0.61), site.y.mul(1.77)).add(seed)),
  }
}

/** A holographic seal: the object wave is the reference grating bent by a field of wax seals, and the fringes between the two drift as the viewer walks, because a hologram is only a picture from one seat. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const {p, view, grazing, intimate} = viewerFrame()
    const tube = uv()
// The wax: concentric rings crossed by radial rays, one seal per lattice site.
    const seal = sealLattice(tube, {
      columns: 35,
      rows: 4,
      seed: 7.3,
    })
    const rings = cos(seal.distance.mul(TAU * 3.2).add(seal.random.x.mul(TAU)))
    const rays = cos(seal.angle.mul(6).add(seal.random.y.mul(TAU))).pow2().pow(3)
    const bloom = cos(seal.distance.mul(TAU * 0.9).add(seal.random.z.mul(TAU)))
    const wax = rings.mul(0.5).add(rays.mul(0.35)).add(bloom.mul(0.25))
// The object wave: the reference grating, bent by the wax and by the angle of the eye.
    const incidence = dot(view, vec3(0.38, -0.72, 0.58).normalize()).mul(2.4)
    const phase = wax.mul(TAU * 1.7).add(grazing.mul(2.4)).add(incidence.mul(4.2)).add(time.mul(0.1))
    const fringe = cos(phase).mul(0.5).add(0.5)
    const resolved = phase.fwidth().smoothstep(0.7, 3.2).oneMinus()
// A hologram only resolves from its own seat: the picture blooms as the eye finds the angle.
    const seat = dot(view, vec3(0.38, -0.72, 0.58).normalize()).smoothstep(0.05, 0.62)
    const picture = mix(float(0.3), fringe.mul(seat.mul(0.6).add(0.4)), resolved.mul(0.8).add(0.2))
// The fine lines only exist for an eye close enough to resolve them.
    const scratches = filament(mx_noise_float(vec2(tube.x.mul(160), tube.y.mul(24))), 0.02).mul(intimate)
    const engrave = picture.mul(0.6).add(scratches.mul(0.25)).add(wax.mul(0.12))
// The colour of a spectral order depends on how far off axis the eye stands.
    const order = mix(float(0.15), float(1.5), grazing.pow(1.7)).add(incidence.mul(0.25))
    const spectrum = cos(vec3(order, order.add(0.33), order.add(0.66)).mul(TAU)).mul(0.5).add(0.5)
    const violet = vec3(0.07, 0.04, 0.11)
    const steel = vec3(0.4, 0.44, 0.55)
    this.colorNode = mix(violet, steel, picture.pow(1.3)).mul(0.55)
    this.metalness = 1
    this.roughnessNode = picture.mul(0.19).add(scratches.mul(0.06)).add(mx_noise_float(p.mul(48)).mul(0.5).add(0.5).mul(0.02)).add(0.05).clamp(0.04, 0.34)
    this.anisotropy = 0.85
    this.anisotropyNode = vec2(1, 0)
    // Relief is measured in object units: a holographic engraving is microscopic, not half a tube deep.
    this.normalNode = proceduralNormal(engrave.mul(0.001).add(scratches.mul(0.00025)), 0.14)
    const rainbow = vec3(spectrum).mul(vec3(1.15, 0.75, 1.35)).add(vec3(0.05, 0.18, 0.28))
    this.emissiveNode = rainbow.mul(picture.pow(2.5)).mul(resolved.mul(0.3).add(0.7)).mul(seat.mul(0.55).add(0.3)).mul(1.7)
      .add(vec3(0.72, 0.86, 1).mul(scratches).mul(intimate).mul(0.08))
      .add(color(hsl.integer(293, 84, 48)).mul(wax.abs().pow(3)).mul(0.05))
  }
}
