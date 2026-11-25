import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, max, mix, mx_noise_float, mx_worley_noise_float, vec2, vec3} from 'three/tsl'

import {inside, visibleDetail} from '../filters.ts'

/** Colors of one cut of travertine, as packed sRGB. */
export type TravertinePalette = {
  /** the cream body of the stone */
  base: number
  /** cool gray streaks of limestone between the warm layers */
  gray: number
  /** chalky, nearly white clouds */
  light: number
  /** the shadowed inside of an unfilled pore */
  pore: number
  /** the honey-colored bands that give vein-cut travertine its grain */
  vein: number
}

/** How a cut of travertine looks, independent of the surface it is laid on. */
export type TravertineStyle = {
  /** strength of the honey bands, 0–1 */
  banding: number
  palette: TravertinePalette
  /** depth of the pores, in meters, for the shading normal */
  poreDepth: number
  /** how much of the stone is pitted by pores, 0–1; 1 matches a coarse, unfilled vein cut */
  pores: number
}

type Float = Node<'float'>

export const travertinePalette: TravertinePalette = {
  base: hsl.integer(80, 30, 63),
  light: hsl.integer(88, 27, 79),
  vein: hsl.integer(73, 45, 48),
  gray: hsl.integer(87, 14, 58),
  pore: hsl.integer(75, 31, 36),
}

const unit = (node: Float) => node.mul(0.5).add(0.5)
const noise = (x: Float, y: Float, seed: Float | number) => mx_noise_float(vec3(x, y, seed))

/**
 * Procedural vein-cut travertine on a plane.
 *
 * `u` runs along the bedding and `v` across it, both in meters, so the stone’s layers show as bands parallel to `u`. The layers wander, the broad ones carry chalky clouds, honey bands and gray streaks, and fine fibrous laminations run through all of them. Pores are ragged vugs stretched along the bedding, from pinholes to a few centimeters long, and they crowd into some layers while others stay nearly solid, as in the quarry. Every feature fades to its average before it is smaller than the pixel `footprint` (meters), so nothing crawls in the distance.
 *
 * Returns the albedo, the pore coverage (pores are rough, dark and recessed), a relief height in meters and the honey band strength.
 */
export function travertine({footprint, seed, style, u, v}: {
  footprint: Float
  seed: Float | number
  style: TravertineStyle
  u: Float
  v: Float
}) {
  const {banding, palette, poreDepth, pores} = style
  const s = typeof seed === 'number' ? float(seed) : seed
  // The layers meander: a slow warp across the bedding, plus a faster ripple.
  const warp = noise(u.mul(0.25), v.mul(0.8), s).mul(0.16).add(noise(u.mul(1.4), v.mul(3.5), s.add(3)).mul(0.04)).add(noise(u.mul(4), v.mul(9), s.add(13)).mul(0.008))
  const w = v.add(warp).toVar('travertineLayer')
  const broad = unit(noise(u.mul(0.18), w.mul(1.4), s.add(1))).toVar('travertineBroad')
  // Bands: two octaves across the bedding, sharpened so each layer has an edge instead of a sine-like swell.
  // Their edges are frayed by a jagged, centimeter-scale warp of their own.
  const frayed = w.add(noise(u.mul(3), w.mul(30), s.add(17)).mul(0.02)).add(noise(u.mul(9), w.mul(80), s.add(18)).mul(0.006))
  const bandField = noise(u.mul(0.45), frayed.mul(12), s.add(2)).mul(0.5).add(noise(u.mul(1.1), frayed.mul(30), s.add(12)).mul(0.38)).add(noise(u.mul(2), frayed.mul(55), s.add(19)).mul(0.12))
  // Each band thins out and swells again along its length, so the stripes never run cleanly across a whole tile.
  const bandPresence = unit(noise(u.mul(0.9), w.mul(2.5), s.add(16))).smoothstep(0.25, 0.75).mul(0.65).add(0.35)
  const bands = unit(bandField).sub(0.5).mul(bandPresence).add(0.5).toVar('travertineBands')
  const grays = unit(noise(u.mul(0.5), w.mul(9), s.add(14))).smoothstep(0.62, 0.8)
  // Fibrous laminations: thin streaks far longer than they are wide.
  const fiberDetail = visibleDetail(footprint, 0.012)
  const fibers = mix(float(0.5), unit(noise(u.mul(2.5), w.mul(140), s.add(4))), fiberDetail)
  const strata = mix(float(0.5), unit(noise(u.mul(0.8), frayed.mul(32), s.add(15))), visibleDetail(footprint, 0.03))
  const clouds = unit(noise(u.mul(2.2), v.mul(2.2), s.add(5)))
  const mottle = mix(float(0.5), unit(noise(u.mul(9), v.mul(12), s.add(20))), visibleDetail(footprint, 0.03))
  const grain = mix(float(0.5), unit(noise(u.mul(28), v.mul(28), s.add(8))), visibleDetail(footprint, 0.012))
  let stone = mix(color(palette.base), color(palette.light), broad.smoothstep(0.3, 0.8))
  stone = mix(stone, color(palette.gray), grays.mul(0.55))
  stone = mix(stone, color(palette.vein), bands.smoothstep(0.46, 0.7).mul(banding))
  stone = mix(stone, color(palette.vein).mul(0.72), bands.smoothstep(0.66, 0.84).mul(banding * 0.8))
  const texture = fibers.sub(0.5).mul(0.2).add(strata.sub(0.5).mul(0.18)).add(clouds.sub(0.5).mul(0.1)).add(mottle.sub(0.5).mul(0.12)).add(grain.sub(0.5).mul(0.12)).add(1)
  stone = stone.mul(texture)
  // Pores: a fractal field stretched along the bedding, thresholded into ragged vugs where the layer is porous.
  const density = unit(noise(u.mul(0.5), w.mul(9), s.add(6))).smoothstep(0.15, 0.7).mul(0.6).add(0.4).mul(pores).toVar('travertinePoreDensity')
  const vugField = noise(u.mul(2.2), w.mul(10), s.add(7)).mul(0.5).add(noise(u.mul(7), w.mul(30), s.add(9)).mul(0.3)).add(noise(u.mul(24), w.mul(90), s.add(10)).mul(0.2)).toVar('travertineVugs')
  const threshold = density.mul(-0.3).add(0.45)
  // Far off, the vugs blend into the share of the stone they would cover.
  const vugDetail = visibleDetail(footprint, 0.08)
  const vugShare = density.mul(density).mul(0.24)
  const vugs = mix(vugShare, inside(threshold.sub(vugField)), vugDetail)
  const vugDepth = mix(vugShare, vugField.sub(threshold).div(0.18).clamp(0, 1), vugDetail)
  // The worn lip around a vug catches the light a little brighter than the face around it.
  const lip = vugField.smoothstep(threshold.sub(0.05), threshold.sub(0.01)).mul(vugs.oneMinus()).mul(vugDetail)
  // Pinholes scattered between the vugs.
  const pinholeDistance = mx_worley_noise_float(vec2(u.mul(9), w.mul(24)).add(s)).add(noise(u.mul(60), w.mul(130), s.add(11)).mul(0.09))
  const pinholeRadius = density.mul(0.16).add(0.03)
  const pinholeDetail = visibleDetail(footprint, 0.03)
  const pinholes = mix(pinholeRadius.mul(pinholeRadius).mul(2.5), inside(pinholeDistance.sub(pinholeRadius)), pinholeDetail)
  const pinholeDepth = mix(pinholeRadius.mul(pinholeRadius).mul(1.5), pinholeRadius.sub(pinholeDistance).div(pinholeRadius).mul(1.6).clamp(0, 1), pinholeDetail)
  // And a fine micro-porosity all over, visible only up close.
  const microDistance = mx_worley_noise_float(vec2(u.mul(32), w.mul(64)).add(s.add(5)))
  const microRadius = density.mul(0.1).add(0.08)
  const micro = mix(microRadius.mul(microRadius).mul(2.5), inside(microDistance.sub(microRadius)), visibleDetail(footprint, 0.015)).mul(0.7)
  const pore = max(max(vugs, pinholes), micro).toVar('travertinePore')
  // Inside a pore, the stone falls into shadow toward its deepest point; the sloped walls light up the rim through the normal.
  const depth = max(max(vugDepth, pinholeDepth), micro.mul(0.6)).toVar('travertinePoreDepth')
  return {
    color: mix(stone.mul(lip.mul(0.08).add(1)), mix(stone.mul(0.8), color(palette.pore), depth.mul(0.85)), pore),
    pore,
    height: depth.mul(-poreDepth),
    bands,
  }
}
