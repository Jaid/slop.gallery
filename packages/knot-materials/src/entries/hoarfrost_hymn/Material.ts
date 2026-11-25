import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, time, vec3} from 'three/tsl'

import {crackNetwork} from '../../candidates/deepseek/lib/crackNetwork.ts'
import {fieldMask} from '../../candidates/deepseek/lib/fieldMask.ts'
import {pixelFootprint} from '../../candidates/deepseek/lib/pixelFootprint.ts'
import {surfaceLine} from '../../candidates/deepseek/lib/surfaceLine.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Rime on night-dark stone. Every grain of the lattice freezes on its own schedule: some are already buried under feathery rosettes, others still show wet stone with the amber heart of the piece glowing through. Branching growth wanders across the whole surface, seeds shine at the center of each grain, needles catch the studio as sharp points of light, and all of it thickens as you come nearer, as if your breath were feeding the ice. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const p = viewerFrame().p
    const {facing, grazing, near, intimate} = viewerFrame()
    const t = time
    const pixel = pixelFootprint()
    const grain = crackNetwork(p, 26, 9, 0.55)
    const identity = mx_noise_float(p.mul(26).add(vec3(7.1, 2.3, 4.9)))
// Grains freeze on their own schedule: slowly over time, eagerly when the viewer comes close.
    const age = identity.mul(0.5).add(0.5).mul(near.mul(0.7).add(0.35)).add(t.mul(Math.PI).sin().mul(0.04)).clamp()
    const rosette = age.smoothstep(0.34, 0.78)
// Feathery growth: ridged fractal noise, warped into branches that wander as the ice creeps.
    const warp = mx_fractal_noise_vec3(p.mul(3.1).add(vec3(t.mul(0.008), 0, t.mul(-0.006))), 3, 2.05, 0.5).mul(0.5)
    const branch = fieldMask(mx_fractal_noise_float(p.mul(5.6).add(warp), 4, 2.1, 0.5), float(0.075).add(rosette.mul(0.075)))
    const twig = fieldMask(mx_fractal_noise_float(p.mul(13).add(warp.mul(1.6)), 4, 2.08, 0.5), float(0.03).add(rosette.mul(0.03)))
// Seams between grains pipe light like the hairline cracks in a freezing pane.
    const seam = surfaceLine(grain.edge, float(0.035), pixel.mul(26))
    const seed = grain.heart.smoothstep(0.16, 0.44).oneMinus()
    const rime = branch.coverage.mul(0.95)
      .max(twig.coverage.mul(0.72))
      .max(seam.coverage.mul(seam.energy.pow(0.6)).mul(rosette).mul(0.8))
      .max(seed.mul(rosette))
      .mul(age.mul(0.45).add(0.4)).clamp()
    const crizzle = mx_noise_float(p.mul(78).add(vec3(0, t.mul(0.02), 0))).mul(0.5).add(0.5)
    const needleSpark = mx_noise_float(p.mul(150).add(vec3(0, t.mul(0.05), 0))).mul(0.5).add(0.5)
    const stone = mix(color(hsl.integer(254, 42, 8)), color(hsl.integer(250, 57, 20)), mx_fractal_noise_float(p.mul(6), 3, 2, 0.5).mul(0.5).add(0.5))
    const ice = mix(color(hsl.integer(254, 88, 48.4)), color(hsl.integer(251, 100, 86.3)), rime.mul(0.6).add(crizzle.mul(0.22)))
// The amber heart only shows where the ice has not closed yet.
    const warm = grazing.pow(1.8).mul(rime.oneMinus().mul(0.5).add(0.22)).mul(near.mul(0.3).add(0.7))
    const relief = rime.mul(0.9).add(branch.coverage.mul(0.4)).add(twig.coverage.mul(0.25)).add(seed.mul(rosette).mul(0.22))
    this.colorNode = mix(stone, ice, rime.mul(0.85).clamp()).add(color(hsl.integer(51, 100, 71)).mul(warm).mul(rime.oneMinus()).mul(0.45))
    const frostNormal: Node<'vec3'> = proceduralNormal(relief, float(0.0024).mul(branch.visibility.mul(0.5).add(0.55)))
    this.normalNode = frostNormal
    this.metalnessNode = rime.mul(-0.1).add(0.06)
    this.roughnessNode = mix(float(0.4), float(0.52), rime).sub(crizzle.mul(0.06))
    this.aoNode = rime.mul(0.22).add(0.78)
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.2
    const glint = glints(frostNormal, 170).mul(rime)
    const spark = glints(frostNormal, 420).mul(rime.pow(0.6)).mul(facing.pow(1.5))
    this.emissiveNode = color(hsl.integer(253, 100, 67.4)).mul(rime.pow(2.2)).mul(0.26)
      .add(color(hsl.integer(240, 100, 96)).mul(glint).mul(near.mul(0.35).add(0.03)))
      .add(color(hsl.integer(63, 100, 79)).mul(warm.pow(2)).mul(intimate.mul(0.4).add(0.12)).mul(0.6))
      .add(color(hsl.integer(250, 100, 96)).mul(spark).mul(near.mul(0.18).add(0.02)))
      .add(color(hsl.integer(0, 0, 100)).mul(needleSpark.smoothstep(0.74, 0.8)).mul(rime).mul(near.mul(0.5).add(0.05)).mul(0.7))
  }
}
