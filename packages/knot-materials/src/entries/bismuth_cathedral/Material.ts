import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mod, mx_fractal_noise_float, mx_hsvtorgb, mx_noise_float, normalLocal, normalViewGeometry, uv, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A bismuth hopper crystal: the melt grew in concentric terraces, and the oxide film that formed on each one is a slightly different thickness, so a single white light leaves as a staircase of color. The terraces are quantized from the tube parameter, which keeps the steps exactly one ring wide all the way around the knot, and the ring index wraps so the staircase closes on itself without a seam. The silhouette only carries a shallow version of the staircase, because the mesh cannot resolve a sharp riser; the shading carries the full one, so the highlights still snap at every edge. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, near} = viewerFrame()
    const tube = uv()
    const warp = mx_fractal_noise_float(p.mul(3.2), 2, 2, 0.5).mul(0.25)
    const coarse = tube.x.mul(16).add(warp)
    const coarseIdx = mod(coarse.floor(), 16)
    const coarseFrac = coarse.fract()
    const fine = tube.x.mul(48).add(warp)
    const fineIdx = mod(fine.floor(), 48)
    const fineFrac = fine.fract()
// The vertex stage cannot call fwidth, so the silhouette uses the plain riser.
    const coarseRiserRaw = coarseFrac.smoothstep(0.94, 1)
    const fineRiserRaw = fineFrac.smoothstep(0.92, 1)
    this.positionNode = p.add(normalLocal.mul(coarseIdx.add(coarseRiserRaw).div(16).mul(0.012).add(fineIdx.add(fineRiserRaw).div(48).mul(0.002))))
// Widen the riser once it falls below a pixel, so distant steps fade instead of shimmering.
    const coarseRiser = coarseFrac.smoothstep(float(0.94).sub(coarse.fwidth().mul(2).min(0.5)), 1)
    const fineRiser = fineFrac.smoothstep(float(0.92).sub(fine.fwidth().mul(2).min(0.5)), 1)
    const terrace = coarseIdx.add(coarseRiser).div(16)
    const fineTerrace = fineIdx.add(fineRiser).div(48)
    const step = terrace.mul(0.5).add(fineTerrace.mul(0.12))
    const riser = coarseRiser.max(fineRiser.mul(0.5))
    const cos = view.dot(normalLocal.normalize()).abs()
    const hue = terrace.mul(2.6).add(cos.mul(0.8)).fract()
    const spectral = mx_hsvtorgb(vec3(hue, 0.85, 1))
    const metal = mix(color(hsl.integer(326, 8, 50)), color(hsl.integer(332, 11, 72)), mx_noise_float(p.mul(7)).mul(0.5).add(0.5))
    this.colorNode = mix(metal, spectral, float(0.55).sub(riser.mul(0.2)))
    this.metalness = 1
    this.roughnessNode = mix(float(0.16), float(0.03), riser)
    this.iridescence = 0.5
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = terrace.mul(320).add(160)
    this.normalNode = proceduralNormal(step, 0.9)
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.06
    const sparkle = glints(normalViewGeometry, 160).mul(riser).mul(near)
    this.emissiveNode = color(hsl.integer(339, 100, 93)).mul(sparkle).mul(0.5)
      .add(color(hsl.integer(338, 100, 90.6)).mul(riser).mul(near).mul(0.06))
  }
}
