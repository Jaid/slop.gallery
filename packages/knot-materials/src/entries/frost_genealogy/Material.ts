import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {abs, color, float, fract, max, min, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalWorld, positionGeometry, positionView, select, time, uv, vec2, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Arc length of the exhibition knot's centerline, in world units per full lap of the tube parameter. */
const knotLapLength = 7.177185
/** Circumference of the knot's tube. */
const knotCircumference = TAU * 0.13
/** Mean centerline speed, used to keep nucleation sites evenly spread along the tube. */
const meanSpeed = knotLapLength / (TAU * 2)

type FrostFieldOptions = {
  /** Nib width of the dendrite filaments, in noise units. */
  bar: number
  /** Teeth cut into the skeleton stems, per stem length. */
  barbs: number
  /** Frequency of the dendrite filaments, per world unit. */
  branches: number
  /** Nucleation sites along one lap of the tube. */
  columns: number
  /** Half-span of a flower, in world units. */
  reach: number
  /** Nucleation sites around one lap of the tube; must be even for the lattice to close. */
  rows: number
  /** Random seed, so neighbouring generations never share an identity. */
  seed: number
  /** Nib width of the skeleton stems, in world units. */
  width: number
}

type FrostField = {
  /** Bright rim along the silhouette, where light scatters through the ice. */
  edge: Node<'float'>
  /** Cottony mist that scatters light around the flowers. */
  haze: Node<'float'>
  /** Antialiased silhouette of the crystal. */
  mask: Node<'float'>
  /** Per-flower identity, for tinting and pulse. */
  random: Node<'vec3'>
}

/** Local stretch of the centerline, so flowers keep their shape where the curve runs fast. */
function centerlineStretch(tube: Node<'vec2'>) {
  const angle = tube.x.mul(TAU * 2)
  const phase = angle.mul(1.5)
  const radius = phase.cos().add(2).mul(0.225)
  const radiusSlope = phase.sin().mul(-0.3375)
  const rise = phase.cos().mul(0.3375)
  return radius.mul(radius).add(radiusSlope.mul(radiusSlope)).add(rise.mul(rise)).sqrt().div(meanSpeed)
}
/** One hexagonal skeleton stem: a tapered nib whose length is eaten into by a sheared sawtooth of barbs. */
function skeletonStem(local: Node<'vec2'>, direction: number, options: FrostFieldOptions, scale: Node<'float'>, root: Node<'float'>) {
  const along = local.x.mul(Math.cos(direction)).add(local.y.mul(Math.sin(direction))).sub(float(options.reach).mul(scale).mul(root))
  const across = local.y.mul(Math.cos(direction)).sub(local.x.mul(Math.sin(direction))).abs()
  const reach = float(options.reach).mul(scale)
  const teeth = fract(along.div(reach).mul(options.barbs).sub(across.div(reach).mul(options.barbs * 1.15)))
  const span = reach.mul(teeth.mul(0.5).add(0.5))
  const nib = float(options.width).mul(scale).mul(teeth.mul(0.85).add(0.3)).mul(abs(along).div(reach).clamp(0, 1).pow(0.8))
  const profile = across.div(nib.max(0.00001))
  const fill = profile.smoothstep(1, 0.35).oneMinus()
  const tip = abs(along).smoothstep(span, span.mul(0.86))
  return {
    edge: fill.mul(tip).mul(profile.smoothstep(0.4, 0.95)),
    fill: fill.mul(tip),
  }
}
/** A generation of hoarfrost: a hexagonal skeleton with a warped dendrite growing out of it. */
function frostField(tube: Node<'vec2'>, options: FrostFieldOptions): FrostField {
  const q = vec2(tube.x.mul(options.columns), tube.y.mul(options.rows))
  const first = q.sub(vec2(0.5, 0.25)).mod(vec2(1, 0.5)).sub(vec2(0.5, 0.25))
  const second = q.sub(vec2(0.5, 0.25)).sub(vec2(0.5, 0.25)).mod(vec2(1, 0.5)).sub(vec2(0.5, 0.25))
  const nearer = select(first.dot(first).lessThan(second.dot(second)), first, second)
  const site = q.sub(nearer)
  const identity = vec2(site.x.mul(0.73), site.y.mul(1.91)).add(options.seed)
  const random = cellNoiseVec3(identity)
  const limbs = cellNoiseVec3(identity.mul(1.37).add(4.1))
  const size = random.y.mul(0.38).add(0.68)
  const cellWidth = knotLapLength / options.columns
  const cellHeight = knotCircumference / options.rows
  // Plumes lean uphill, the way hoarfrost climbs a cold pane.
  const spin = random.x.sub(0.5).mul(0.8)
  const cosine = spin.cos()
  const sine = spin.sin()
  const raw = vec2(nearer.x.div(centerlineStretch(tube)), nearer.y).mul(vec2(cellWidth, cellHeight)).mul(size)
  const local = vec2(raw.x.mul(cosine).sub(raw.y.mul(sine)), raw.x.mul(sine).add(raw.y.mul(cosine)))
  const reach = float(options.reach).mul(size)
  const distance = local.length()
  const third = TAU / 3
  // Six short spines mark where the crystal nucleated; the dendrite takes over from there.
  const arms = [limbs.x, limbs.y, limbs.z, limbs.z, limbs.y, limbs.x].map((limb, index) => skeletonStem(local, index * third * 0.5, options, size.mul(limb.mul(0.3).add(0.22)), limb.mul(0.3).add(0.04)))
  const skeleton = min(min(min(arms[0].fill, arms[1].fill), min(arms[2].fill, arms[3].fill)), min(min(arms[4].fill, arms[5].fill), float(2)))
  // The dendrite: a domain-warped contour network, stretched along the growth direction, so the ice feathers.
  const stretched = vec2(local.x, local.y.mul(0.55))
  const warpScale = options.branches * 0.22
  const warp = vec2(mx_noise_float(stretched.mul(warpScale).add(3.1)), mx_noise_float(stretched.mul(warpScale).add(9.7))).mul(0.42 / warpScale)
  const field = mx_noise_float(stretched.mul(options.branches).add(warp).add(identity.x.mul(5.5)))
  const bloom = distance.smoothstep(reach.mul(1.3), reach.mul(0.12)).oneMinus()
  const dendrite = filament(field, options.bar).mul(bloom)
  // Second generation: needles that only grow where the first generation already reached.
  const needles = filament(mx_noise_float(stretched.mul(options.branches * 3.1).add(warp.mul(3.1).add(field.mul(0.5))).add(11.3)), options.bar * 1.1)
    .mul(dendrite.smoothstep(0, 0.35)).mul(bloom).mul(0.5)
  const plate = min(abs(local.x), abs(local.x).mul(0.5).add(abs(local.y).mul(0.8660254)))
  const core = plate.smoothstep(reach.mul(0.13), reach.mul(0.05)).oneMinus()
  const footprint = distance.fwidth().max(0.0001)
  const resolved = float(options.width).mul(3.2)
  const sharp = footprint.smoothstep(resolved.mul(0.25), resolved).oneMinus()
  const flower = max(max(max(skeleton, dendrite.mul(0.95)), needles), core)
  return {
    edge: max(arms[0].edge, arms[1].edge).mul(sharp.mul(0.4).add(0.6)),
    haze: distance.smoothstep(reach.mul(2.1), 0).oneMinus().mul(flower.mul(0.4).add(0.06)).mul(footprint.smoothstep(resolved.mul(1.2), resolved.mul(7)).oneMinus().mul(0.6).add(0.4)),
    mask: flower.mul(sharp.mul(0.35).add(0.65)),
    random,
  }
}

/** Hoarfrost on a cold pane: hexagonal plumes crowding a feathery freezing front, and a sky that never quite sets. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
// The cold runs along the seam under the knot; the crown keeps its bare glass.
    const cold = tube.y.mul(TAU).cos().mul(0.5).add(0.5)
    const drift = mx_fractal_noise_float(p.mul(2.9), 3, 2.1, 0.5)
// Frost advances in fingers, never in a smooth contour: a fine frill eats the edge of every patch.
    const frill = mx_fractal_noise_float(p.mul(17).add(vec3(1.3, 4.1, 9.7)), 3, 2.2, 0.5)
    const breath = time.mul(0.037).sin().mul(0.03).add(time.mul(0.015).sin().mul(0.016))
    const field = drift.mul(0.52).add(cold.sub(0.36).mul(0.5)).sub(0.04).add(breath)
    const coverage = field.add(frill.mul(0.13).add(0.065)).smoothstep(0.26, 0.46)
// The freezing front, read from the smooth patch field: the frill is far too fine to carry a gradient.
    const smoothCoverage = field.smoothstep(0.26, 0.46)
// Ice grows fastest at the edge of a patch: a screen-space gradient recovers that front, whatever the zoom.
    const front = smoothCoverage.fwidth().div(positionView.fwidth().length().max(0.0001)).clamp(0, 1)
// Two generations of plumes: the mature flowers and the buds that swarm at the freezing front.
    const plumes = frostField(tube, {
      bar: 0.011,
      barbs: 6,
      branches: 44,
      columns: 54,
      reach: 0.072,
      rows: 6,
      seed: 3.1,
      width: 0.0026,
    })
    const buds = frostField(tube, {
      bar: 0.0095,
      barbs: 4,
      branches: 118,
      columns: 132,
      reach: 0.032,
      rows: 14,
      seed: 11.7,
      width: 0.0014,
    })
    const germinate = (patchCoverage: Node<'float'>, bias: number) => max(patchCoverage.mul(0.22), front.mul(0.85)).mul(bias).clamp(0, 1)
    const plume = plumes.mask.mul(germinate(coverage, 0.95))
    const bud = buds.mask.mul(germinate(coverage, 0.8))
    const crystal = max(plume, bud)
    const scattering = max(plumes.edge.mul(plume), buds.edge.mul(bud))
    const haze = max(plumes.haze, buds.haze).mul(coverage).mul(intimate.mul(0.5).add(0.5))
// Ice deepens away from the freezing front: a misty rim, then feathering, then a crystalline core.
    const depth = coverage.mul(0.35).add(front.mul(-0.6)).add(0.55).clamp(0, 1)
    const condensation = beads(p.mul(38).add(2.9), 1.7)
// A breath of rime still sits on the glass inside a patch, thin enough to keep the dark behind it.
    const film = coverage.mul(front.oneMinus().mul(0.5).add(0.3))
// Only the smooth coverage reaches the vertex stage; crystal relief is a normal-map concern.
    this.positionNode = positionGeometry.add(normalLocal.mul(coverage.mul(knotData.displacement)))
    const sky = normalWorld.y.mul(0.5).add(0.5)
    const glass = mix(color(hsl.integer(262, 45, 3.3)), color(hsl.integer(256, 38, 6)), sky.pow(1.3))
    const rime = mix(color(hsl.integer(251, 29, 56)), color(hsl.integer(249, 36, 77)), sky.mul(0.6).add(0.2))
    this.colorNode = mix(mix(glass, color(hsl.integer(254, 34, 30)), film.mul(0.8)), mix(rime, color(hsl.integer(250, 100, 94)), scattering.mul(0.85)), crystal.mul(0.95).mul(depth.mul(0.45).add(0.55)))
    this.metalness = 0
    this.roughnessNode = crystal.mul(0.4).mul(depth).add(film.mul(0.2)).add(haze.mul(0.2)).sub(scattering.mul(0.14)).sub(condensation.core.mul(0.05)).add(0.08).clamp(0.03, 0.82)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.clearcoatNormalNode = proceduralNormal(haze.mul(0.4).add(condensation.core.mul(0.3)), 0.22)
    this.iridescence = 0.35
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = scattering.mul(140).add(film.mul(320)).add(230)
    const relief = crystal.mul(0.34).mul(depth.mul(0.7).add(0.3)).add(haze.mul(0.22)).add(condensation.core.mul(0.12))
    const iceNormal = proceduralNormal(relief, 0.28)
    this.normalNode = iceNormal
// A pane at four in the morning still remembers a sky.
    const backlit = sky.pow(1.5).add(grazing.mul(0.3))
    const dust = mx_noise_float(p.mul(120))
    const sparkle = glints(iceNormal, 140).mul(dust.mul(0.5).add(0.5)).mul(intimate)
    this.emissiveNode = mix(color(hsl.integer(250, 62, 38)), color(hsl.integer(238, 100, 85)), crystal)
      .mul(crystal.mul(0.16).mul(depth).add(scattering.mul(0.6)).add(haze.mul(0.35)))
      .mul(backlit.mul(0.6).add(0.4))
      .mul(coverage.mul(0.5).add(0.5))
      .mul(0.16)
      .add(color(hsl.integer(240, 100, 96)).mul(sparkle).mul(crystal).mul(depth).mul(0.55))
      .add(color(hsl.integer(240, 100, 88.5)).mul(condensation.core).mul(0.06))
      .add(color(hsl.integer(246, 99, 76)).mul(scattering).mul(grazing.pow(2)).mul(near).mul(0.12))
      .add(min(front.mul(0.3), crystal).mul(0.08))
  }
}
