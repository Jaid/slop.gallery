import type {MarbleStyle} from './marble.ts'
import type {Node} from 'three/webgpu'

import {color, float, mix, mx_noise_float, vec3} from 'three/tsl'

import {inside, visibleDetail} from '../filters.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** Like `line`, for a half-width given as a node. */
const band = (d: Float, halfWidth: Float) => inside(d.abs().sub(halfWidth)).mul(halfWidth.mul(2).div(d.fwidth().max(0.00001)).min(1))

/**
 * Marble carved from a solid block: the veins are warped sheets through the stone, and every surface shows where it cuts them.
 *
 * The sheets lie roughly perpendicular to `bedding`, so a block cut on the diagonal shows veins streaming across it, and a turned bowl shows them wrapping it in the curves of its profile. Unlike a pattern mapped onto the surface, the veins continue over every edge, around every corner and through every crease without a seam. Features fade to their average before they are smaller than the pixel `footprint` (meters).
 */
export function solidMarble({bedding, footprint, position, scale = 1, seed, style}: {
  /** direction the vein sheets stack along */
  bedding: readonly [number, number, number]
  footprint: Float
  position: Node<'vec3'>
  /** size of the pattern relative to a block about a meter across */
  scale?: number
  seed: number
  style: MarbleStyle
}) {
  const p = position.div(scale)
  const noise = (frequency: number, offset: number) => mx_noise_float(p.mul(frequency).add(seed * 1.37 + offset))
  // The distance in meters to the zero set of a field: the field over its screen-space slope, in pixels, times the pixel size.
  const meters = (field: Float) => field.div(field.fwidth().max(1e-7)).mul(footprint)
  const n = new Float32Array(bedding)
  const nl = Math.hypot(n[0], n[1], n[2])
  const along = p.dot(vec3(n[0] / nl, n[1] / nl, n[2] / nl))
  // Clouds: broad drifting shade in the body, with finer mottling close up.
  const clouds = unit(noise(0.9, 4)).mul(0.55).add(mix(float(0.5), unit(noise(3.2, 5)), visibleDetail(footprint, 0.06)).mul(0.3)).add(mix(float(0.5), unit(noise(9, 20)), visibleDetail(footprint, 0.02)).mul(0.15)).smoothstep(0.25, 0.8)
  // Main veins: sheets stacked along the bedding, bent by two octaves of warp and crooked by a fine jag.
  const warp = noise(0.55, 1).mul(0.8).add(noise(1.7, 2).mul(0.18))
  const jag = noise(6, 14).mul(0.05).add(noise(19, 15).mul(0.02)).mul(visibleDetail(footprint, 0.02))
  const course = along.mul(2.2).add(warp).mul(Math.PI).sin().mul(0.5)
  const main = meters(course.add(jag))
  // Each vein swells and thins along its course, and breaks off in places; a soft stain bleeds into the stone around it.
  const swell = unit(noise(1.3, 7)).smoothstep(0.15, 0.7)
  const thickness = unit(noise(2.6, 16)).mul(1.1).add(0.25)
  const veins = band(main.div(thickness), float(style.veinWidth)).mul(swell.smoothstep(0.1, 0.6))
  const halo = main.abs().smoothstep(0, 0.07).oneMinus().pow(1.5).mul(swell.mul(0.6).add(0.4))
  // Thinner companion sheets between the main ones, where the stone cracked twice.
  const companion = band(meters(along.mul(3.1).add(warp.mul(1.3)).add(noise(1.2, 8).mul(0.6)).mul(Math.PI).sin().mul(0.5).add(jag)), float(style.veinWidth * 0.5)).mul(unit(noise(0.8, 9)).smoothstep(0.5, 0.85))
  // Loose hairline threads, close up only.
  const threads = band(meters(noise(2.5, 11).add(noise(6.5, 12).mul(0.3)).add(jag)), float(0.0006)).mul(unit(noise(1.5, 13)).smoothstep(0.6, 0.85)).mul(visibleDetail(footprint, 0.01))
  let stone = mix(color(style.base), color(style.cloud), clouds)
  stone = mix(stone, color(style.halo), halo.mul(style.haloStrength))
  stone = mix(stone, color(style.thread), threads.mul(style.threadStrength))
  const vein = veins.max(companion)
  stone = mix(stone, color(style.vein), vein)
  return {
    color: stone,
    vein,
  }
}
