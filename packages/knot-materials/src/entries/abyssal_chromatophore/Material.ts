import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, Loop, mix, mx_noise_float, time, uv, vec3, vec4} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Accumulate complete pigment cells, including the portions crossing into neighboring cells. */
const pigmentCells = Fn(([position, phase, arousal]: [Node<'vec3'>, Node<'float'>, Node<'float'>]) => {
  const cell = position.floor().toVar()
  const local = position.fract().toVar()
  const footprint = position.fwidth().length().max(0.001).toVar()
  const visibility = footprint.smoothstep(0.35, 1.2).oneMinus().toVar()
  const coverage = float(0).toVar()
  const pigment = vec3(0).toVar()
  Loop(27, ({i}) => {
    const offset = vec3(i.mod(3), i.div(3).mod(3), i.div(9)).sub(1)
    const identity = cell.add(offset).toVar()
    const random = cellNoiseVec3(identity).toVar()
    // Seed from the feature's integer identity, never from a second, shifted sampling grid.
    const secondary = cellNoiseVec3(identity.add(vec3(17.3, 5.9, 41.2))).toVar()
    const center = offset.add(random.mul(0.5).add(0.25))
    const distance = local.sub(center).length()
    const wave = phase.add(secondary.z.mul(1.5)).sin().mul(0.5).add(0.5)
    const radius = arousal.mul(wave.mul(0.5).add(0.5)).mul(0.32).add(0.04).mul(secondary.x.mul(0.5).add(0.75))
    // Before visibility reaches zero, support <= 0.45 + 1.2 * 0.6 = 1.17.
    // Features outside this 3x3x3 neighborhood are at least 1.25 units away.
    const mask = distance.smoothstep(radius.sub(footprint), radius.add(footprint.mul(0.6))).oneMinus().mul(visibility)
    const tint = mix(mix(color(hsl.integer(20, 94, 50)), color(hsl.integer(55.3, 100, 70.7)), random.y), color(hsl.integer(6, 83, 25)), secondary.y.mul(0.5))
    coverage.addAssign(mask)
    pigment.addAssign(tint.mul(mask))
  })
  // Blend overlapping cells without letting coverage exceed physical material ranges.
  return vec4(pigment.div(coverage.max(0.000001)), coverage.clamp())
})
/** RGB contains colored core/halo emission; alpha contains the photophore surface mask. */
const photophoreCells = Fn(([position, sweep, intimate]: [Node<'vec3'>, Node<'float'>, Node<'float'>]) => {
  const cell = position.floor().toVar()
  const local = position.fract().toVar()
  // Bound minification support; a 0.35 halo fits within the neighboring-cell search.
  const outer = position.fwidth().length().max(0.001).mul(0.8).add(0.07).min(0.35).toVar()
  const emission = vec3(0).toVar()
  const coverage = float(0).toVar()
  Loop(27, ({i}) => {
    const offset = vec3(i.mod(3), i.div(3).mod(3), i.div(9)).sub(1)
    const identity = cell.add(offset).toVar()
    const random = cellNoiseVec3(identity).toVar()
    const secondary = cellNoiseVec3(identity.add(vec3(7.7, 23.1, 3.3))).toVar()
    const center = offset.add(random.mul(0.6).add(0.2))
    const distance = local.sub(center).length()
    const present = secondary.x.smoothstep(0.55, 0.6)
    const core = distance.smoothstep(0.045, outer).oneMinus().mul(present)
    const twinkle = time.mul(secondary.y.mul(3).add(1)).add(secondary.z.mul(20)).sin().mul(0.5).add(0.5)
    const glowGate = sweep.mul(1.2).add(twinkle.mul(0.25)).add(intimate.mul(0.5))
    const tint = mix(color(hsl.integer(208.2, 100, 83.1)), color(hsl.integer(181, 100, 94)), secondary.z)
    const halo = distance.smoothstep(0, 0.35).oneMinus().mul(present)
    emission.addAssign(tint.mul(core.mul(1.8).add(halo.mul(0.35))).mul(glowGate))
    coverage.addAssign(core)
  })
  return vec4(emission, coverage.clamp())
})

/** Deep-sea skin. Velvet-black with pigment cells that dilate toward whoever is looking and blush in waves along the body; photophores flash in a travelling sweep, and when you stare straight at it, the photophores stare back. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const skinNoise = mx_noise_float(p.mul(18))
    const cq = p.mul(26).add(skinNoise.mul(0.15))
    const phase = tube.x.mul(Math.PI * 2 * 3).sub(time.mul(1.4))
    const arousal = facing.pow(1.4).mul(near.mul(0.7).add(0.3))
    const cells = pigmentCells(cq, phase, arousal).toVar()
    const pigment = cells.rgb
    const chroma = cells.a
    const pq = p.mul(11).add(vec3(3.7, 1.1, 9.4))
    const sweep = tube.x.mul(Math.PI * 2 * 2).sub(time.mul(0.9)).sin().mul(0.5).add(0.5).pow(10)
    const lights = photophoreCells(pq, sweep, intimate).toVar()
    const photophore = lights.a
    const eyeshine = photophore.mul(facing.pow(10)).mul(near)
    this.colorNode = mix(color(hsl.integer(299, 60, 4)), pigment, chroma.mul(0.9))
    this.metalness = 0
    this.roughnessNode = float(0.55).mix(0.3, chroma)
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(286, 80, 39)), color(hsl.integer(357, 100, 68)), grazing).mul(0.75)
    this.sheenRoughnessNode = float(0.6)
    this.clearcoatNode = float(0.6).add(photophore.mul(0.4))
    this.clearcoatRoughness = 0.12
    this.retroreflectivity = 0.5
    this.retroreflectivityNode = photophore.mul(0.9)
    this.normalNode = proceduralNormal(chroma.mul(0.7).add(photophore.mul(1.2)).add(skinNoise.mul(0.12)), 0.0011)
    this.emissiveNode = lights.rgb
      .add(color(hsl.integer(0, 0, 100)).mul(eyeshine).mul(2.5))
      .add(color(hsl.integer(287, 89, 25)).mul(rim).mul(0.18))
      .add(pigment.mul(chroma).mul(intimate).mul(0.08))
  }
}
