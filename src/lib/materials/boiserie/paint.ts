import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, vec3} from 'three/tsl'

import {visibleDetail} from '../filters.ts'

/** Colors of a painted, gilded interior, as packed sRGB. */
export type BoiseriePalette = {
  /** the gilt of the moldings, beads and bands */
  gilt: number
  /** the gilt’s worn, shadowed hollows */
  giltShadow: number
  /** the wall paint */
  paint: number
  /** a deeper shade of the paint for the chair rail, baseboards and plinths */
  paintDeep: number
}

type Float = Node<'float'>

/** Slate-blue paint with antique gold, after the mockup of the Banquet. */
export const slateBoiserie: BoiseriePalette = {
  paint: hsl.integer(248, 28, 35),
  paintDeep: hsl.integer(252, 27, 26),
  gilt: hsl.integer(83, 68, 76),
  giltShadow: hsl.integer(78, 63, 53),
}

const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Hand-troweled eggshell paint on plaster: faint, broad clouds where the coats overlap, plus a fine stipple from the roller.
 *
 * `u` and `v` are in meters on the wall. Returns the albedo factor around 1 and a relief height in meters; both fade to flat before their features get smaller than the pixel `footprint`.
 */
export function paintedPlaster({footprint, u, v, seed = 0}: {
  footprint: Float
  /** a number, or a uniform to share one shader between surfaces that differ only in their seed */
  seed?: Float | number
  u: Float
  v: Float
}) {
  const s = typeof seed === 'number' ? float(seed) : seed
  const broad = unit(mx_noise_float(vec3(u.mul(0.35), v.mul(0.35), s))).mul(0.6).add(unit(mx_noise_float(vec3(u.mul(1.3), v.mul(1.3), s.add(3)))).mul(0.4))
  const trowel = mix(float(0.5), unit(mx_noise_float(vec3(u.mul(2.4), v.mul(1.6), s.add(1)))), visibleDetail(footprint, 0.08))
  const stipple = mix(float(0.5), unit(mx_noise_float(vec3(u.mul(70), v.mul(70), s.add(2)))), visibleDetail(footprint, 0.006))
  // Where the trowel left a thinner coat, the darker undercoat shows through in soft flecks.
  const flecks = mix(float(0.5), unit(mx_noise_float(vec3(u.mul(9), v.mul(9), s.add(4)))), visibleDetail(footprint, 0.03))
  return {
    shade: broad.sub(0.5).mul(0.26).add(trowel.sub(0.5).mul(0.1)).add(flecks.sub(0.5).mul(0.08)).add(stipple.sub(0.5).mul(0.07)).add(1),
    height: stipple.sub(0.5).mul(0.0004).add(trowel.sub(0.5).mul(0.0003)),
  }
}

/** Antique water gilding: a warm gold that is worn toward its shadow color in patches. */
export function gilt({palette, u, v}: {
  palette: BoiseriePalette
  u: Float
  v: Float
}) {
  const wear = unit(mx_noise_float(vec3(u.mul(3.1), v.mul(3.1), float(7)))).smoothstep(0.35, 0.85)
  const leaf = unit(mx_noise_float(vec3(u.mul(23), v.mul(23), float(9)))).smoothstep(0.3, 0.7)
  return mix(color(palette.gilt), color(palette.giltShadow), wear.mul(0.45)).mul(leaf.mul(0.12).add(0.94))
}
