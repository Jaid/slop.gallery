import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn as fn, Loop as loop, mix, mx_noise_float, vec3} from 'three/tsl'

import {glitter} from '../../candidates/deepseek/lib/glitter.ts'
import {loopDrift, loopOsc} from '../../candidates/deepseek/lib/loopClock.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Whole growing crystals, including those centered in adjacent lattice cells. */
const frostField = fn(([q, p, breath, near]: [Node<'vec3'>, Node<'vec3'>, Node<'float'>, Node<'float'>]) => {
  const cell = q.floor()
  const local = q.fract()
  const footprint = q.fwidth().length()
  const visibility = footprint.smoothstep(0.2, 0.8).oneMinus()
  const coverage = vec3(0).toVar()
  loop(27, ({i}) => {
    const neighbor = vec3(i.mod(3), i.div(3).mod(3), i.div(9)).sub(1)
    const rnd = cellNoiseVec3(cell.add(neighbor))
    const offset = local.sub(neighbor.add(rnd.mul(0.5).add(0.25)))
    const radius = offset.length()
    const theta = atan(offset.y, offset.x)
    const growth = loopOsc(1, rnd.z.mul(TAU).add(p.dot(vec3(2.4, 1.1, -3.1)))).mul(breath.mul(0.22).add(0.32)).add(breath.mul(0.08).add(0.14))
    const lobes = theta.mul(6).add(rnd.x.mul(TAU)).cos()
    const subLobes = theta.mul(18).add(rnd.y.mul(TAU)).cos()
    const boundary = growth.mul(lobes.mul(0.5).add(0.5).pow(1.4).mul(0.62).add(0.44)).mul(subLobes.mul(0.07).add(0.93))
    const crystal = radius.sub(boundary)
    // Filter from continuous coordinates, not cell-dependent angular phases.
    const angularFootprint = footprint.div(offset.xy.length().max(0.05))
    const aa = footprint.add(angularFootprint.mul(growth).mul(4)).min(0.1).max(0.0006)
    const frost = crystal.smoothstep(aa.negate(), aa).oneMinus()
    const dust = crystal.smoothstep(-0.045, 0.05).oneMinus().mul(0.34)
    const fan = theta.mul(42).add(rnd.z.mul(TAU)).cos().mul(0.5).add(0.5)
    const fanVisibility = angularFootprint.mul(42).smoothstep(0.6, 3).oneMinus()
    const needles = mix(float(5 / 16), fan.pow(3), fanVisibility).mul(frost).mul(near.mul(0.7).add(0.3))
    coverage.assign(coverage.max(vec3(frost, dust, needles)))
  })
  return coverage.mul(visibility)
})
/** Localized facets, rather than random normals covering entire grid cells. */
function frostGlitter(position: Node<'vec3'>, cellSize: number, sharpness: number, tilt: number) {
  const facets = glitter(position, cellSize, sharpness, tilt)
  const q = position.div(cellSize)
  const center = cellNoiseVec3(q.floor()).mul(0.5).add(0.25)
  const distance = q.fract().sub(center).length()
  const outer = q.fwidth().length().add(0.18).min(0.24)
  const mask = distance.smoothstep(0.06, outer).oneMinus()
  return {
    lean: facets.lean.mul(mask),
    sparkle: facets.sparkle.mul(mask),
  }
}

/** Hoarfrost that grows and evaporates. Every nucleation site raises a hexagonal star of needles whose radius follows a harmonic of the two-second loop with a travelling phase, so waves of freezing sweep the knot, fan out and retreat. Each crystal is a tilted facet: it glitters when it catches the key light and goes dull a moment later. Warm breath widens the growth where a visitor stands, and the fine fan structure only resolves at arm's length. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, grazing, distance, near, intimate} = viewerFrame()
    const cellSize = 0.072
    const q = p.div(cellSize)
    const breath = distance.smoothstep(1.05, 3.1).oneMinus()
    const crystals = frostField(q, p, breath, near)
    const frost = crystals.x
    const dust = crystals.y
    const needles = crystals.z
    const drifts = mx_noise_float(loopDrift(p.mul(2.2), 0.5))
    const depth = mix(color(hsl.integer(240, 35, 4)), color(hsl.integer(252, 47, 8)), drifts.mul(0.5).add(0.5))
    const crystalColor = mix(color(hsl.integer(244, 35, 74)), color(hsl.integer(243, 100, 98)), needles.mul(0.6))
    const frostHeight = frost.mul(0.5).add(dust.mul(0.28)).add(needles.mul(0.3)).add(mx_noise_float(p.mul(38)).mul(0.05))
    const ice = frostGlitter(p, 0.021, 64, 0.6)
    const snow = frostGlitter(loopDrift(p, 0.05), 0.041, 26, 0.85)
    this.colorNode = mix(mix(depth, crystalColor, frost.mul(0.72).add(dust.mul(0.34)).min(1)), crystalColor.mul(1.08), ice.sparkle.mul(intimate).mul(0.5))
    this.roughnessNode = mix(float(0.42).sub(near.mul(0.1)), float(0.2), frost.mul(0.8).add(dust.mul(0.5)).min(1)).sub(ice.sparkle.mul(0.06)).clamp(0.05, 0.5)
    this.metalness = 0
    this.ior = 1.31
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.09
    this.iridescence = 0.2
    this.iridescenceThicknessNode = mx_noise_float(p.mul(14)).mul(0.5).add(0.5).mul(380).add(260)
    this.normalNode = proceduralNormal(frostHeight, 0.0011).add(ice.lean.mul(0.55)).add(snow.lean.mul(0.12)).normalize()
    this.emissiveNode = color(hsl.integer(253, 80, 72)).mul(frost.mul(needles.mul(0.4).add(0.14)).mul(0.18))
      .add(color(hsl.integer(247, 100, 93)).mul(grazing.pow(3.2)).mul(frost.mul(0.22).add(dust.mul(0.35)).add(0.05)).mul(0.45))
      .add(color(hsl.integer(85, 100, 95.3)).mul(snow.sparkle).mul(0.36))
      .add(color(hsl.integer(250, 100, 90)).mul(ice.sparkle).mul(intimate).mul(0.6))
      .add(color(hsl.integer(248, 57, 38)).mul(distance.smoothstep(0.9, 2.8).oneMinus()).mul(frost.mul(0.7).add(0.3)).mul(0.06))
      .add(color(hsl.integer(255, 100, 90)).mul(breath.pow(3)).mul(0.05))
  }
}
