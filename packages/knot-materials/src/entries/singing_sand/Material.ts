import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, cos, float, mix, mx_fractal_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionViewDirection, positionWorld, sin, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Arc length of the exhibition knot's centerline, in world units per full lap of the tube parameter. */
const knotLapLength = 7.177185
/** The tube is this many times longer than it is wide; modes are numbered to keep the figures square. */
const knotAspect = knotLapLength / (TAU * 0.13)

type PlateMode = {
  /** Unfiltered nodal band, safe to displace with in the vertex stage. */
  band: Node<'float'>
  /** Standing-wave amplitude of the plate, in [-1, 1]. */
  field: Node<'float'>
  /** How high the sand heaps where the plate is still, once unresolved heaps have thinned out. */
  heap: Node<'float'>
}

type PlateOptions = {
  /** Lowest mode order in the mix. */
  base: number
  /** How many notes the plate is ringing at once. */
  count: number
  /** Seed for the mode mix, so two chords never share a figure. */
  seed: number
}

/** Deterministic per-mode randomness, resolved on the CPU: the mix never has to agree with itself per pixel. */
function mix32(value: number) {
  let hashed = value + 0x9E_37_79_B9
  hashed = Math.imul(hashed ^ hashed >>> 15, 0x85_EB_CA_6B)
  hashed = Math.imul(hashed ^ hashed >>> 13, 0xC2_B2_AE_35)
  return ((hashed ^ hashed >>> 16) >>> 0) / 4_294_967_296
}
/** A plate ringing in several modes at once: the sand settles on the nodal lines, the zero set of the superposition. Mode numbers are integers, so the figure closes around the tube, and each mode drifts slowly, which is what keeps the figure alive. */
function plateMode(tube: Node<'vec2'>, {base, count, seed}: PlateOptions): PlateMode {
  const along: Array<number> = []
  const across: Array<number> = []
  const phase: Array<number> = []
  const wobble: Array<number> = []
  for (let index = 0; index < count; index++) {
    const key = seed * 131 + index * 17
    // Orders climb geometrically, the way the overtones of a plate do.
    const order = base * 1.52 ** index * (mix32(key) * 0.5 + 0.78)
    along.push(Math.max(1, Math.round(order * knotAspect)))
    across.push(Math.max(1, Math.round(order)))
    phase.push(mix32(key + 7) * TAU)
    wobble.push(mix32(key + 23) * TAU)
  }
  let field: Node<'float'> = float(0)
  let weight = 0
  for (const [index, order] of along.entries()) {
    const amplitude = 1 / (index + 1) ** 0.42
    const drift = wobble[index]
    const mode = cos(tube.x.mul(TAU * order).add(tube.y.mul(TAU * across[index])).add(phase[index])
      .add(sin(tube.x.mul(TAU * (across[index] + 1)).add(drift)).mul(0.35))).mul(amplitude)
    field = field.add(mode)
    weight += amplitude
  }
  const standing = field.div(weight)
  const band = standing.abs().smoothstep(0.055, 0)
  // Heaps are widest where the plate is flattest, and thin out once the sand is finer than a pixel.
  const footprint = standing.fwidth().max(0.0001)
  const heap = band.mul(footprint.smoothstep(0.01, 0.09).oneMinus().mul(0.65).add(0.35))
  return {
    band,
    field: standing,
    heap,
  }
}

/** Chladni figures on a brass plate: sand gathering into the silent lines while the note slowly changes. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {near, intimate, grazing} = viewerFrame()
    const tube = uv()
// The plate is always ringing in two notes at once, drifting into each other like a choir.
    const drift = time.mul(0.021).sin().mul(0.5).add(0.5)
    const low = plateMode(tube, {
      base: 2.2,
      count: 6,
      seed: 3.7,
    })
    const high = plateMode(tube, {
      base: 4.4,
      count: 6,
      seed: 19.1,
    })
    const listening = near.mul(0.75).add(drift.mul(0.25))
    const heap = mix(low.heap, high.heap, listening)
    const band = mix(low.band, high.band, listening)
    const standing = mix(low.field, high.field, listening)
// Loose grains that never found a node, and the dust the plate collects between them.
    const grain = mx_fractal_noise_float(positionWorld.mul(420), 2, 2.3, 0.5).mul(0.5).add(0.5)
    const stray = grain.mul(0.5).add(0.18).mul(intimate.mul(0.5))
    const dust = mx_fractal_noise_float(positionWorld.mul(26), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const tarnish = dust.smoothstep(0.52, 0.86)
    const sand = heap.mul(0.9).add(stray.mul(0.3)).clamp(0, 1)
    const relief = band.mul(0.75).add(grain.mul(0.07).mul(intimate))
    this.positionNode = positionGeometry.add(normalLocal.mul(relief.mul(knotData.displacement)))
    const brass = mix(color(hsl.integer(83, 62, 54)), color(hsl.integer(77, 58, 32)), tarnish.mul(0.6))
    const polished = mix(brass, color(hsl.integer(78, 60, 20)), grazing.mul(0.4).mul(tarnish))
    const quartz = mix(color(hsl.integer(87, 50, 90)), color(hsl.integer(79, 46, 73)), grain.mul(0.5).add(0.25))
    this.colorNode = mix(polished, quartz, sand.mul(0.94))
    this.metalnessNode = sand.oneMinus()
    this.roughnessNode = sand.mul(0.62).add(tarnish.mul(0.16)).add(grain.mul(0.05).mul(intimate)).add(0.26).clamp(0.2, 0.95)
    this.anisotropy = 0.65
    this.anisotropyNode = vec2(0, 1)
// Mica in the quartz catches the lamps in a few places at a time.
    const lamps = [vec3(0.35, 0.78, 0.52), vec3(-0.62, 0.28, 0.73), vec3(0.1, -0.35, 0.93)]
    let glint: Node<'float'> = float(0)
    for (const lamp of lamps) {
      glint = glint.add(normalViewGeometry.dot(lamp.normalize().add(positionViewDirection).normalize()).clamp().pow(300))
    }
    const sparkle = glint.mul(grain.mul(0.5).add(0.5)).mul(intimate)
    this.normalNode = proceduralNormal(relief, 0.2)
    this.emissiveNode = color(hsl.integer(89, 100, 95.8)).mul(sparkle).mul(sand).mul(1.2)
      .add(color(hsl.integer(81, 100, 86)).mul(standing.abs().oneMinus().pow(8)).mul(grazing.pow(2)).mul(near.mul(0.3).add(0.12)).mul(0.35))
  }
}
