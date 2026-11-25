import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Seam = {
  core: Node<'float'>
  mask: Node<'float'>
}
/** One generation of breaks. The distance between the nearest two Voronoi features is a true distance to the cell wall, so a seam can be filtered by its own screen footprint and comes out evenly wide instead of flickering. Lacquer fills only part of the break, the way a mender works. */
const seam = (p: Node<'vec3'>, {scale, seed, width, filled}: {
  filled: Node<'float'>
  scale: number
  seed: number
  width: number
}): Seam => {
  const wall = cellularBoundary(p.mul(scale).add(vec3(seed, seed * 0.7, seed * 1.31)))
  const breath = mx_noise_float(p.mul(scale * 9).add(vec3(seed * 3.1, 1.7, seed)))
  const gauge = float(width).mul(breath.mul(0.75).add(0.55))
  const mask = hairline(wall, gauge).mul(filled)
  const core = hairline(wall, gauge.mul(0.42)).mul(filled)
  return {
    mask,
    core,
  }
}
/** Kintsugi: a black urushi vessel, shattered and mended with gold. Three generations of break run under the lacquer – the great shatter, the chips that fell from it, and the hairline craze inside each remaining piece. The lacquer is a deep, almost lightless red that only reveals itself at grazing angles, and a slow warmth still runs the length of the metal. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const {p, grazing, near, intimate, rim} = viewerFrame()
    const shatter = seam(p, {
      scale: 1.85,
      seed: 2.4,
      width: 0.075,
      filled: float(1),
    })
    const chipGate = mx_noise_float(p.mul(3.4).add(vec3(7.1, 2.2, 5.8))).mul(0.5).add(0.5).smoothstep(0.3, 0.52)
    const chips = seam(p, {
      scale: 5.1,
      seed: 11.7,
      width: 0.07,
      filled: chipGate,
    })
    const crazeGate = mx_noise_float(p.mul(9.5).add(vec3(1.1, 6.3, 2.9))).mul(0.5).add(0.5).smoothstep(0.46, 0.62).mul(near)
    const craze = seam(p, {
      scale: 17,
      seed: 23.3,
      width: 0.055,
      filled: crazeGate,
    })
    const gold = max(max(shatter.mask.mul(0.62), chips.mask.mul(0.8)), craze.mask.mul(0.7)).clamp(0, 1)
    const goldCore = max(max(shatter.core.mul(0.62), chips.core.mul(0.85)), craze.core.mul(0.7)).clamp(0, 1)
// Urushi: dozens of hand-brushed layers, each with its own slow ripple.
    const brush = mx_fractal_noise_float(p.mul(6.5).add(vec3(3.7, 1.1, 8.2)), 3, 2.1, 0.55)
    const depth = mx_fractal_noise_float(p.mul(2.3).add(vec3(0.4, 5.6, 2.9)), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const lacquer = mix(color(hsl.integer(337, 18, 4)), color(hsl.integer(13, 43, 7.5)), depth.pow(1.4)).mul(brush.mul(0.06).add(0.97))
    const bubble = cellularPoints(p.mul(78), 0.02, 0.11, 0.62).mul(intimate)
    const leaf = color(hsl.integer(80, 78, 71)).mul(mx_noise_float(p.mul(120).add(vec3(4, 5, 6))).mul(0.1).add(0.95))
    const goldColor = mix(leaf, color(hsl.integer(89, 100, 92)), goldCore.pow(1.6))
    this.colorNode = mix(lacquer, goldColor, gold)
    this.metalnessNode = gold.mul(0.95).add(0.03)
    this.roughnessNode = mix(float(0.2).add(brush.mul(0.05)), float(0.115).add(brush.mul(0.04)), gold).sub(bubble.mul(0.04))
    this.clearcoatNode = gold.oneMinus().mul(0.95).add(0.05)
    this.clearcoatRoughnessNode = mix(float(0.06), float(0.18), bubble)
    this.ior = 1.52
    this.sheenNode = gold.oneMinus().mul(0.12)
    this.sheenColor.set(hsl.integer(22, 62, 37))
    this.sheenRoughness = 0.3
// The gold sits proud of the lacquer, and the lacquer is not perfectly flat.
    const relief = gold.mul(0.0026).sub(brush.mul(0.00012)).add(bubble.mul(0.00035))
    const bump = proceduralNormal(relief, 1.1)
    this.normalNode = bump
// The lacquer is polished over the repair, so the clearcoat follows the same relief.
    this.clearcoatNormalNode = bump
// Only derivative-free fields may reach positionNode: screen-space footprints do not exist in the
// vertex stage, so the seams themselves are shaded, not displaced, and the lacquer's own undulation
// is what gives the silhouette its hand-made swell.
    this.positionNode = positionGeometry.add(normalLocal.mul(brush.mul(0.0016)))
// A slow warmth still runs the length of the metal, brightest where the mender pooled it deepest.
    const front = p.x.mul(0.8).add(p.y.mul(0.35)).add(p.z.mul(0.2)).sub(time.mul(0.21))
    const flare = front.mul(front).mul(-5).exp().pow(0.8)
    const glint = glints(bump, 160).mul(gold).mul(goldCore)
    this.emissiveNode = color(hsl.integer(79, 100, 85)).mul(gold.mul(flare).mul(1.35))
      .add(color(hsl.integer(85, 100, 93)).mul(glint.mul(0.5)))
      .add(color(hsl.integer(72, 100, 79.1)).mul(goldCore.mul(flare).mul(0.35)))
      .add(color(hsl.integer(18, 72, 14)).mul(grazing.pow(2.2).mul(0.35)))
      .add(color(hsl.integer(32, 70, 28)).mul(rim.pow(3).mul(0.22)))
      .add(gold.mul(flare.mul(0.02)))
  }
}
