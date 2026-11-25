import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, normalViewGeometry, vec3} from 'three/tsl'

import {lampFlash} from '../../candidates/space_bunny/lib/lampFlash.ts'
import {loopDrift, loopPhase} from '../../candidates/space_bunny/lib/loopClock.ts'
import {microGlitter} from '../../candidates/space_bunny/lib/microGlitter.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Tented profile of a crack: full inside the seam, zero at its banks, with a hot filament core. */
function seamProfile(field: Node<'float'>, width: Node<'float'>) {
  const tent = field.abs().div(width).oneMinus().max(0).pow(0.65)
  const core = field.abs().smoothstep(width.mul(0.22), width.mul(0.5)).oneMinus()
  return {
    tent,
    core,
  }
}
/** Urushi porcelain, deliberately shattered and mended with gold. The body keeps the memory of the blow: hairline crazing, chipped edges down to the raw clay, a gloss that pools in every dip. The seams themselves are geometry – a gold-filled groove that proud of the glaze, catching the lamps only when you stand where the reflection wants you, and still holding an ember of the flame that made it. The gold is sampled a hair deeper than the glaze, so leaning in slides the metal inside its own channel instead of lighting it flat. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
// The glaze: warm white, unevenly fired, with pores and the shadow of old repairs.
    const warp = mx_fractal_noise_float(p.mul(2.3), 3, 2.05, 0.5)
    const firing = mx_noise_float(p.mul(1.7).add(vec3(5.1, -2.2, 0.8))).mul(0.5).add(0.5)
    const pores = mx_noise_float(p.mul(52)).mul(0.5).add(0.5)
    const chip = mx_noise_float(p.mul(3.4).add(vec3(-3.7, 4.4, 1.2))).smoothstep(0.44, 0.56).mul(near.mul(0.55).add(0.45))
    const crazeCells = mx_worley_noise_vec3(p.mul(46), 1, 0)
    const craze = filament(crazeCells.y.sub(crazeCells.x), 0.005).mul(near.mul(0.7).add(0.3))
// The mending: a wandering trunk seam with finer branches, its width pooling and thinning.
    const widthField = mx_noise_float(p.mul(5.5).add(vec3(1.1, 2.2, 3.3))).mul(0.7).add(0.75)
    const trunkWidth = float(0.03).mul(widthField)
    const trunk = seamProfile(mx_noise_float(p.mul(2.55).add(warp.mul(0.7)).add(vec3(3.2, -1.7, 5.1))), trunkWidth)
    const branchWidth = float(0.0085).mul(widthField)
    const branch = seamProfile(mx_noise_float(p.mul(7.1).add(warp.mul(1.1)).add(vec3(-6.3, 2.8, 1.5))), branchWidth)
    const hairline = filament(mx_noise_float(p.mul(15.5).add(warp.mul(0.8))), 0.004).mul(near)
    const gold = trunk.tent.max(branch.tent.mul(0.72)).max(hairline.mul(0.3))
// The blow left a fissure wider than the gold that filled it; what is left open reads as shadow.
    const fissure = seamProfile(mx_noise_float(p.mul(2.55).add(warp.mul(0.7)).add(vec3(3.2, -1.7, 5.1))), trunkWidth.mul(2.6)).tent
    const shadow = fissure.sub(gold).max(0)
    const goldCore = trunk.core.max(branch.core.mul(0.6))
// Sampling the seam a groove-depth behind the glaze banks it: the profile difference is the lit
// edge of the channel, and it flips to whichever side you happen to be standing on.
    const sunken = seamProfile(mx_noise_float(p.sub(view.mul(0.011)).mul(2.55).add(warp.mul(0.7)).add(vec3(3.2, -1.7, 5.1))), trunkWidth).tent
    const bevel = gold.sub(sunken)
// Gold leaf is never one colour: pale at the banks, deep in the trough.
    const leafShimmer = mx_noise_float(loopDrift(p.mul(9.5), 0.1, 2).add(warp.mul(2))).mul(0.5).add(0.5)
    const leaf = mix(color(hsl.integer(81, 76, 74)), color(hsl.integer(74, 89, 49)), leafShimmer)
    const dust = microGlitter(p, 0.021, 90, 0.5).sparkle
    const dustGate = mx_noise_float(p.mul(7)).smoothstep(0.28, 0.42).mul(near)
    const glaze = mix(color(hsl.integer(82, 14, 44)), color(hsl.integer(85, 18, 59)), firing).mul(pores.mul(0.06).oneMinus().mul(0.1).add(0.9))
    const clay = mix(color(hsl.integer(73, 17, 42)), color(hsl.integer(67, 18, 26)), firing)
    const body = mix(glaze, clay, chip.mul(0.85))
    this.colorNode = mix(mix(body, color(hsl.integer(55, 21, 8)), shadow.mul(0.92)), leaf, gold.mul(0.96))
    this.aoNode = shadow.mul(0.5).add(chip.mul(0.3)).oneMinus().clamp(0.4, 1)
    this.metalnessNode = gold.mul(0.9)
    this.roughnessNode = float(0.17).add(pores.mul(0.06)).add(chip.mul(0.55)).sub(gold.mul(0.08)).add(gold.mul(leafShimmer.mul(0.09))).sub(bevel.max(0).mul(0.1)).clamp(0.05, 0.85)
    this.ior = 1.52
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.055).add(chip.mul(0.3)).sub(gold.mul(0.03)).clamp(0.02, 0.4)
    this.clearcoatNormalNode = proceduralNormal(goldCore.mul(0.12).mul(near), 0.0006)
// The groove the gold was poured into, with the proud metal sitting inside it.
    const relief = gold.mul(0.55).add(bevel.mul(0.4)).sub(chip.mul(0.35)).sub(craze.mul(0.12)).sub(pores.mul(near).mul(0.06))
    this.normalNode = proceduralNormal(relief, 0.006)
    const ember = loopPhase.mul(2).sin().mul(0.5).add(0.5).pow(2).mul(0.6).add(0.4)
    const glint = lampFlash(normalViewGeometry, 54)
    this.emissiveNode = color(hsl.integer(61, 100, 74)).mul(goldCore.mul(ember).mul(0.32))
      .add(leaf.mul(bevel.max(0)).mul(0.22))
      .add(color(hsl.integer(89, 100, 97)).mul(glint.mul(gold).mul(0.85)))
      .add(color(hsl.integer(85, 100, 88.5)).mul(dust).mul(dustGate).mul(intimate).mul(0.9))
      .add(color(hsl.integer(257, 100, 85.4)).mul(craze.mul(0.05)))
      .add(color(hsl.integer(80, 100, 92.4)).mul(grazing.pow(4)).mul(chip.oneMinus()).mul(0.07))
  }
}
