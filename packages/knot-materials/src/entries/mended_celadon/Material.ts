import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_worley_noise_vec3, normalLocal, time, transformNormalToView, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {environmentHighlight, studioSheen} from '../../candidates/deepseek/lib/environment.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A thin, bright zero set around the nearest Voronoi wall. */
const wall = (border: Node<'float'>, width: Node<'float'> | number) => {
  const w = typeof width === 'number' ? float(width) : width
  const footprint = border.fwidth().max(0.0004)
  return border.smoothstep(w, w.add(footprint.mul(1.15)).add(0.0008)).oneMinus()
}
/**
 * A celadon porcelain knot, shattered and repaired with gold. The glaze carries a quiet Longquan green
 * that deepens at the silhouette; a primary network of gold-filled breaks is overlaid with hairline crazing
 * and pale chips of exposed bisque. Move around it and the gold veins catch the room one at a time.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
// The fracture network is warped before it is measured, so no wall is mechanically straight.
    const warp = mx_fractal_noise_float(p.mul(3.1).add(vec3(7.3, 1.7, -4.1)), 3, 2.03, 0.52)
    const primary = p.mul(4.15).add(vec3(warp.mul(0.16), warp.mul(0.11), warp.mul(0.19)))
    const primaryField = mx_worley_noise_vec3(primary, 1, 0)
    const primaryBorder = primaryField.y.sub(primaryField.x)
    const primaryWidth = mx_fractal_noise_float(p.mul(7.7).add(19.2), 2, 2.1, 0.5)
      .smoothstep(-0.45, 0.55).mul(0.04).add(0.02)
    const goldPrimary = wall(primaryBorder, primaryWidth)
// A second, younger set of breaks branches through the glaze at a smaller scale.
    const secondary = p.mul(10.4).add(vec3(warp.mul(0.27), warp.mul(0.2), warp.mul(0.24)))
    const secondaryField = mx_worley_noise_vec3(secondary, 1, 0)
    const secondaryBorder = secondaryField.y.sub(secondaryField.x)
    const goldSecondary = wall(secondaryBorder, 0.008)
      .mul(mx_fractal_noise_float(p.mul(4.2).add(31.4), 2, 2.1, 0.5).smoothstep(-0.35, 0.65).mul(0.7).add(0.3))
      .mul(0.72)
// Hairline crazing lives inside the glaze and only resolves when the visitor leans in.
    const craze = p.mul(29).add(vec3(warp.mul(0.4), warp.mul(0.34), warp.mul(0.3)))
    const crazeField = mx_worley_noise_vec3(craze, 1, 0)
    const crazeBorder = crazeField.y.sub(crazeField.x)
    const crazeWidth = crazeBorder.fwidth().max(0.001).mul(0.9).add(0.0025)
    const crackle = crazeBorder.smoothstep(crazeWidth, crazeWidth.add(crazeBorder.fwidth().max(0.001).mul(1.4))).oneMinus()
      .mul(intimate.mul(0.85).add(0.15))
      .mul(mx_fractal_noise_float(p.mul(6.2).add(2.1), 2, 2.2, 0.5).smoothstep(-0.4, 0.6).mul(0.55).add(0.45))
// Glaze that flaked away exposes the ivory, sugar-rough bisque underneath.
    const chipField = mx_fractal_noise_float(p.mul(4.6).add(vec3(-8.1, 3.6, 12.4)), 3, 2.04, 0.51).mul(0.5).add(0.5)
    const chip = chipField.smoothstep(0.815, 0.845).mul(intimate.mul(0.55).add(0.45))
    const goldMask = goldPrimary.max(goldSecondary).clamp()
    const seamCore = primaryBorder.smoothstep(primaryWidth.mul(0.12), primaryWidth.mul(0.62)).oneMinus()
// Depth in the glaze: a quieter green in the hollows, a watery pale green where the surface faces the room.
    const mottle = mx_fractal_noise_float(p.mul(2.2).add(41.7), 3, 2.01, 0.53).mul(0.5).add(0.5)
    const celadon = mix(color(hsl.integer(176, 42, 41)), color(hsl.integer(163, 32, 76)), mottle)
    const hollow = mix(color(hsl.integer(179, 45, 22)), celadon, facing.mul(0.45).add(0.3))
    const glazeColor = mix(hollow, celadon, facing.mul(0.42).add(0.18))
    const pooled = mx_fractal_noise_float(p.mul(13).add(7.7), 2, 2.2, 0.5).mul(0.5).add(0.5)
    const bisque = mix(color(hsl.integer(81, 32, 69)), color(hsl.integer(83, 39, 86.5)), pooled)
    const goldColor = mix(color(hsl.integer(57, 86, 41)), color(hsl.integer(87, 75, 86)), seamCore.mul(0.7).add(mottle.mul(0.3)))
    this.colorNode = mix(mix(glazeColor, bisque, chip), goldColor, goldMask)
    this.metalnessNode = goldMask
    this.roughnessNode = mix(float(0.075).add(chip.mul(0.52)).add(crackle.mul(0.035)), float(0.18).sub(seamCore.mul(0.06)), goldMask).clamp(0.03, 0.92)
    this.clearcoatNode = goldMask.oneMinus().mul(chip.oneMinus()).mul(0.96)
    this.clearcoatRoughness = 0.035
    this.sheen = 0.18
    this.sheenColor.set(hsl.integer(157, 46, 92))
    this.sheenRoughness = 0.42
    const relief = goldMask.mul(0.0016).sub(chip.mul(0.0008)).sub(crackle.mul(0.00008))
    this.normalNode = detailNormal(baseNormal, relief, 0.9)
    const shimmer = time.mul(0.28).add(mottle.mul(8)).sin().mul(0.08).add(0.92)
    const goldHighlight = environmentHighlight(environment, n, 0.12).mul(goldColor).mul(goldMask).mul(shimmer).mul(0.62)
    const keySpot = view.negate().reflect(n).dot(vec3(-0.35, 0.78, 0.52).normalize()).clamp().pow(260)
    const warmSheen = studioSheen(n).mul(goldColor).mul(goldMask).mul(0.18).add(goldColor.mul(keySpot).mul(goldMask).mul(0.42))
    const glazeRim = mix(color(hsl.integer(159, 46, 87.6)), color(hsl.integer(87, 51, 93.6)), mottle).mul(grazing.pow(3)).mul(0.045)
    const crackleGlow = mix(color(hsl.integer(172, 32, 65)), color(hsl.integer(87, 55, 91.6)), mottle).mul(crackle).mul(intimate).mul(0.022)
    this.emissiveNode = goldHighlight.mul(near.mul(0.8).add(0.45)).add(warmSheen).add(glazeRim).add(crackleGlow)
    this.aoNode = float(1).sub(goldMask.mul(0.16)).sub(chip.mul(0.1))
  }
}
