import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, Fn, max, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, tangentLocal, time, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {displacementView} from '../../lib/displacementView.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Fold the plane into a 30° wedge with exact six-fold symmetry, the way a snow crystal obeys one. */
const wedge = Fn(([q]: [Node<'vec2'>]) => {
  const p = q.abs().toVar()
  const fold = () => p.assign(p.mul(0.5).sub(p.yx.mul(0.8660254)).abs())
  fold()
  fold()
  fold()
  fold()
  return p
})
type FrostStarShape = {
  length: Node<'float'> | number
  rib: Node<'float'> | number
  spacing: Node<'float'> | number
  width: Node<'float'> | number
}
type FrostStar = {
  mask: Node<'float'>
  solid: Node<'float'>
}
const scalar = (value: Node<'float'> | number) => (typeof value === 'number' ? float(value) : value)
type FrostLayer = {
  mask: Node<'float'>
  solid: Node<'float'>
  veins: Node<'float'>
}

type Site = {
  angle: Node<'float'>
  offset: Node<'vec2'>
  random: Node<'vec3'>
}
/** A single hoarfrost star inside a 30° wedge. The spine tapers from the nucleation point, side branches leave it at the hexagonal 60° angle and shorten toward the tips, and a solid needle core thickens the middle. Every width is compared against its own screen footprint, so a star that shrinks below a pixel dissolves into its own mean instead of aliasing into glitter. */
function frostStar(q: Node<'vec2'>, shape: FrostStarShape): FrostStar {
  const p = wedge(q)
  const reach = scalar(shape.length)
  const rib = scalar(shape.rib)
  const spacing = scalar(shape.spacing)
  const width = scalar(shape.width)
  const x = p.x
  const y = p.y
  const taper = x.div(reach).clamp(0, 1)
  const spineWidth = width.mul(taper.oneMinus().pow(0.75))
  const foot = x.fwidth().max(1e-5).add(y.fwidth().max(1e-5))
  const spine = y.smoothstep(spineWidth.add(foot.mul(0.6)), spineWidth).oneMinus()
// Side branches: lines of constant x − y/√3, the hexagonal branch direction inside the wedge.
  const branch = x.sub(y.mul(0.5773503)).div(spacing)
  const branchFoot = branch.fwidth().max(0.02)
  const branchLine = branch.fract().sub(0.5).abs().sub(0.5).abs()
  const branchWidth = rib.div(spacing)
  const ribLine = branchLine.smoothstep(branchWidth.add(branchFoot), branchWidth).oneMinus()
  const branchReach = spineWidth.mul(2.4).mul(taper.mul(0.5).oneMinus())
  const ribbed = ribLine.mul(y.smoothstep(branchReach, branchReach.mul(0.7)).oneMinus()).mul(taper.pow(0.35))
// The rim of a real star is ragged, and the crystal simply stops where it stops.
  const end = x.smoothstep(reach, reach.mul(0.82)).oneMinus()
  const core = y.smoothstep(spineWidth.mul(2.6).add(foot), spineWidth.mul(0.4)).oneMinus()
  const mask = max(spine, ribbed).mul(end).mul(taper.pow(6).oneMinus())
  return {
    mask,
    solid: core.mul(end).mul(taper.pow(3).oneMinus()),
  }
}
const turn = (q: Node<'vec2'>, angle: Node<'float'>) => vec2(q.x.mul(angle.cos()).sub(q.y.mul(angle.sin())), q.x.mul(angle.sin()).add(q.y.mul(angle.cos())))
/** A jittered lattice of nucleation sites in object space. Reading the site from a 3D cell – rather than from the tube's unwrapped UV – keeps the crystal field continuous everywhere, including across the seam where the knot's own parameter closes on itself. */
const site = (p: Node<'vec3'>, scale: number, seed: number): Site => {
  const cell = p.mul(scale).floor()
  const random = cellNoiseVec3(cell.add(vec3(seed, seed * 1.7, seed * 0.31)))
  const nucleus = cell.add(0.5).add(random.sub(0.5).mul(0.66)).div(scale)
  const delta = p.sub(nucleus)
  const T = tangentLocal
  const B = bitangentLocal as unknown as Node<'vec3'>
  return {
    offset: vec2(delta.dot(T), delta.dot(B)),
    angle: random.z.mul(Math.PI * 6),
    random,
  }
}
type BandOptions = {
  reach: number
  rib: number
}
/** One generation of hoarfrost: hexagonal stars of a single size, present only where the cold has settled. */
const frostBand = ({angle, random, offset}: Site, {reach, rib}: BandOptions, presence: Node<'float'>): FrostLayer => {
  const size = random.y.mul(0.62).add(0.52)
  const settled = presence.sub(random.x.mul(0.5).sub(0.24)).smoothstep(0, 0.18)
  const crystal = (length: Node<'float'>) => frostStar(turn(offset, angle), {
    length,
    rib: length.mul(rib),
    spacing: length.mul(0.2).add(0.004),
    width: length.mul(0.09).add(0.002),
  })
  const base = crystal(float(reach).mul(size))
  const grown = crystal(float(reach).mul(size).mul(presence.mul(0.35).add(0.78)))
  return {
    mask: grown.mask.mul(settled),
    solid: grown.solid.mul(settled),
    veins: base.mask.mul(settled),
  }
}
/** Hoarfrost on cold iron. Every star is a genuine six-fold crystal: a tapered spine with side branches leaving at the hexagonal 60° angle, each site given its own size and orientation. Frost settles in broad drifts, breathes slowly outward, and a finer generation of needles only resolves once a visitor leans close enough for it to span more than a pixel. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, grazing, intimate, rim} = viewerFrame()
    const {near} = displacementView()
    const drift = mx_fractal_noise_float(p.mul(1.9).add(vec3(3.7, 1.1, 5.3)), 3, 2.1, 0.55)
    const swell = time.mul(0.085).add(drift.mul(0.6)).sin().mul(0.5).add(0.5)
    const presence = drift.add(swell.mul(0.12).sub(0.06)).smoothstep(-0.26, 0.3)
    const coarse = frostBand(site(p, 9, 3.7), {
      reach: 0.05,
      rib: 0.22,
    }, presence)
    const medium = frostBand(site(p, 22, 11.3), {
      reach: 0.024,
      rib: 0.24,
    }, presence.mul(near))
    const needles = frostBand(site(p, 54, 29.1), {
      reach: 0.009,
      rib: 0.28,
    }, presence.mul(intimate))
    const stars = max(coarse.mask, medium.mask.mul(0.9)).max(needles.mask.mul(0.75))
    const veins = max(coarse.veins.mul(0.45), max(medium.veins.mul(0.3), needles.veins.mul(0.25)))
    const solid = max(coarse.solid, medium.solid.mul(0.85)).max(needles.solid.mul(0.7))
// The rime crust: a broad, soft coverage that fills the ground between the stars.
    const crustNoise = mx_fractal_noise_float(p.mul(13).add(vec3(0.9, 4.2, 7.7)), 3, 2.3, 0.5).mul(0.5).add(0.5)
    const crustFoot = p.mul(13).fwidth().length()
    const crust = crustNoise.smoothstep(0.3, 0.72).mul(crustFoot.smoothstep(0.4, 1.4).oneMinus()).mul(0.55).add(0.45)
    const grainNoise = mx_fractal_noise_float(p.mul(58), 2, 2.5, 0.5).mul(0.5).add(0.5)
    const grainFoot = p.mul(58).fwidth().length()
    const grain = grainNoise.smoothstep(0.34, 0.8).mul(grainFoot.smoothstep(0.35, 1.3).oneMinus())
    const frost = presence.mul(crust.mul(0.72).add(grain.mul(0.28).mul(near))).add(stars.mul(0.85)).add(solid.mul(0.45)).clamp(0, 1)
    const ironNoise = mx_fractal_noise_float(p.mul(11).add(vec3(2.2, 7.1, 1.4)), 3, 2.05, 0.5)
    const pit = ironNoise.mul(0.5).add(0.5)
    const cold = color(hsl.integer(245, 58, 95))
    const ice = mix(color(hsl.integer(241, 30, 77)), cold, stars.mul(0.6).add(solid.mul(0.4)).clamp(0, 1))
    const iron = mix(color(hsl.integer(253, 19, 10)), color(hsl.integer(253, 17, 30)), pit.pow(1.5))
    this.colorNode = mix(iron, ice, frost)
    this.metalnessNode = frost.oneMinus().mul(0.72).add(0.04)
    this.roughnessNode = float(0.5).sub(solid.mul(0.42)).sub(frost.mul(0.1)).add(ironNoise.mul(0.05)).sub(near.mul(0.04)).clamp(0.035, 0.75)
    this.clearcoatNode = frost.mul(0.65)
    this.clearcoatRoughnessNode = mix(float(0.34), float(0.05), solid)
    this.ior = 1.31
    this.sheenNode = stars.mul(0.4).mul(near)
    this.sheenColor.set(hsl.integer(255, 100, 90))
    this.sheenRoughness = 0.35
// The crust that carries the crystals is smooth and derivative-free, so the silhouette can be
// displaced in the vertex stage; the crystals themselves live entirely in the surface shading.
    const lump = mx_noise_float(p.mul(3.7).add(vec3(5.3, 2.1, 7.7)))
    const fine = mx_noise_float(p.mul(11.5).sub(vec3(1.3, 4.9, 0.7)))
    this.positionNode = positionGeometry.add(normalLocal.mul(presence.mul(lump.mul(0.6).add(fine.mul(0.22)).add(0.34)).mul(0.005).mul(near.mul(0.5).add(0.5))))
    const relief = frost.mul(0.0018).add(stars.mul(0.0011)).sub(veins.mul(0.0005))
    const bump = proceduralNormal(relief.mul(near.mul(0.6).add(0.4)), 0.9)
    this.normalNode = bump
    const sparkField = mx_fractal_noise_float(p.mul(260), 2, 2.5, 0.5).mul(0.5).add(0.5)
    const sparkFoot = p.mul(260).fwidth().length()
    const sparkBody = sparkField.smoothstep(0.7, 0.97).mul(sparkFoot.smoothstep(0.3, 1).oneMinus())
    const glint = glints(bump, 110).mul(stars).mul(solid.mul(0.6).add(0.4)).mul(sparkBody.add(0.2))
    this.emissiveNode = color(hsl.integer(243, 100, 88)).mul(glint.mul(0.4))
      .add(color(hsl.integer(0, 0, 100)).mul(glint.pow(4)).mul(1.2))
      .add(color(hsl.integer(251, 54, 59)).mul(frost.pow(2.5).mul(0.14)))
      .add(color(hsl.integer(245, 100, 94)).mul(rim.mul(stars.mul(0.8).add(0.2)).mul(0.1)))
      .add(color(hsl.integer(257, 49, 34)).mul(grazing.pow(3).mul(0.05)))
  }
}
