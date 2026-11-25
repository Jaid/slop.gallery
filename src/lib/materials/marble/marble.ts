import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec2, vec2, vec3} from 'three/tsl'

import {inside, line, visibleDetail} from '../filters.ts'

/** How a cut of marble looks, independent of the surface it is laid on. Colors are packed sRGB, strengths 0–1. */
export type MarbleStyle = {
  /** the body of the stone */
  base: number
  /** the drifting clouds in the body, lighter or darker than the base */
  cloud: number
  /** the soft, wide stain the main veins bleed into the body */
  halo: number
  haloStrength: number
  /** fine hairline cracks of the fracture web */
  thread: number
  threadStrength: number
  /** the long main veins */
  vein: number
  /** half-width of the main veins at their widest, in meters */
  veinWidth: number
  /** strength of the fracture webs between the main veins: the coarse one in `vein`, the fine hairlines in `thread` */
  web: number
}

type Float = Node<'float'>

/** White Calacatta: ivory with drifting gray clouds and a few soft gray veins. */
export const calacatta: MarbleStyle = {
  base: hsl.integer(85, 23, 93),
  cloud: hsl.integer(79, 14, 75),
  halo: hsl.integer(80, 13, 75),
  haloStrength: 0.5,
  thread: hsl.integer(81, 9, 57),
  threadStrength: 0.6,
  vein: hsl.integer(77, 7, 45),
  veinWidth: 0.0022,
  web: 0.85,
}

/** Black Portoro: near-black with a web of golden fracture veins and the odd white thread. */
export const portoro: MarbleStyle = {
  base: hsl.integer(286, 5, 9),
  cloud: hsl.integer(68, 6, 21),
  halo: hsl.integer(76, 43, 25),
  haloStrength: 0.7,
  thread: hsl.integer(81, 14, 84),
  threadStrength: 0.55,
  vein: hsl.integer(77, 65, 69),
  veinWidth: 0.003,
  web: 1,
}

/** Black Nero Marquina: near-black with a dense, brittle crackle of bone-white veins. */
export const neroMarquina: MarbleStyle = {
  base: hsl.integer(286, 6, 7),
  cloud: hsl.integer(286, 7, 15),
  halo: hsl.integer(286, 5, 25),
  haloStrength: 0.45,
  thread: hsl.integer(85, 8, 84),
  threadStrength: 1,
  vein: hsl.integer(85, 18, 93.4),
  veinWidth: 0.003,
  web: 0.7,
}

/** Warm cream marble with soft, smoky umber veins that flow rather than crack. */
export const cremaMarfil: MarbleStyle = {
  base: hsl.integer(80, 26, 90),
  cloud: hsl.integer(78, 24, 72),
  halo: hsl.integer(75, 19, 62),
  haloStrength: 0.8,
  thread: hsl.integer(76, 14, 58),
  threadStrength: 0.6,
  vein: hsl.integer(74, 15, 40),
  veinWidth: 0.004,
  web: 0.8,
}

const unit = (node: Float) => node.mul(0.5).add(0.5)
const noise = (x: Float, y: Float, seed: Float) => mx_noise_float(vec3(x, y, seed))
/** Like `line`, for a half-width given as a node. */
const band = (d: Float, halfWidth: Float) => inside(d.abs().sub(halfWidth)).mul(halfWidth.mul(2).div(d.fwidth().max(0.00001)).min(1))

/** The coverage fields of a marble pattern, 0–1 each, before any colors are applied. */
export type MarblePattern = ReturnType<typeof marblePattern>

/**
 * The layout of procedural polished marble on a plane, with `u` and `v` in meters, independent of its colors.
 *
 * The body is domain-warped clouds; long main veins follow the zero lines of a warped noise and bleed a soft halo into the stone (with `drift`, they stream along `u` side by side instead of meandering and closing into loops); between them runs a coarse web of fracture veins from the cell edges of a warped Worley pattern, and a finer web of hairline cracks, both fading in and out in patches. Every feature fades to its average coverage before it is smaller than the pixel `footprint` (meters), so nothing crawls in the distance.
 */
export function marblePattern({drift = false, footprint, name = 'marble', seed, u, v, veinWidth}: {
  /** whether the main veins and the fracture web stream along `u`, as in a stone cut along its bedding, instead of meandering in every direction */
  drift?: boolean
  footprint: Float
  /** prefix of the shader variables, unique per call within one material */
  name?: string
  seed: Float | number
  u: Float
  v: Float
  /** half-width of the main veins at their widest, in meters */
  veinWidth: Float | number
}) {
  const s = typeof seed === 'number' ? float(seed) : seed
  const width = typeof veinWidth === 'number' ? float(veinWidth) : veinWidth
  // The distance in meters to the zero line of a field: the field over its screen-space slope, in pixels, times the pixel size. Thresholding the raw field instead would swell every vein into a puddle wherever the field flattens out.
  const meters = (field: Float) => field.div(field.fwidth().max(1e-7)).mul(footprint)
  // Two octaves of domain warp make the veins flow and fold instead of following straight noise contours.
  const warpU = noise(u.mul(0.42), v.mul(0.42), s).mul(0.55).add(noise(u.mul(1.6), v.mul(1.6), s.add(2)).mul(0.12))
  const warpV = noise(u.mul(0.42), v.mul(0.42), s.add(1)).mul(0.55).add(noise(u.mul(1.6), v.mul(1.6), s.add(3)).mul(0.12))
  const qu = u.add(warpU).toVar(`${name}U`)
  const qv = v.add(warpV).toVar(`${name}V`)
  const clouds = unit(noise(qu.mul(0.9), qv.mul(0.9), s.add(4))).mul(0.55).add(mix(float(0.5), unit(noise(qu.mul(3.2), qv.mul(3.2), s.add(5))), visibleDetail(footprint, 0.06)).mul(0.3)).add(mix(float(0.5), unit(noise(qu.mul(9), qv.mul(9), s.add(20))), visibleDetail(footprint, 0.02)).mul(0.15)).smoothstep(0.22, 0.82)
  // Main veins: the zero lines of a warped noise, each swelling and thinning along its length.
  // A fine, jagged warp of their own breaks the veins’ smooth contours into the crooked course of a real fracture.
  const jag = noise(qu.mul(6), qv.mul(6), s.add(14)).mul(0.05).add(noise(qu.mul(19), qv.mul(19), s.add(15)).mul(0.02)).mul(visibleDetail(footprint, 0.02))
  // Drifting veins are the level lines of a gently warped ramp across `v`; the warp is too shallow to fold a line back on itself, so they never close into loops.
  const course = drift ? qv.mul(1.5).add(noise(qu.mul(0.35), qv.mul(0.35), s.add(22)).mul(0.8)).mul(Math.PI).sin().mul(0.5) : noise(qu.mul(0.45), qv.mul(1.1), s.add(6))
  const main = meters(course.add(jag)).toVar(`${name}MainVein`)
  const swell = unit(noise(qu.mul(1.3), qv.mul(1.3), s.add(7))).smoothstep(0.2, 0.75)
  const halo = main.abs().smoothstep(0, 0.03).oneMinus().mul(swell.mul(0.6).add(0.4))
  // Each vein thins to a thread and swells again along its course, and breaks off in places.
  const thickness = unit(noise(qu.mul(2.6), qv.mul(2.6), s.add(16))).mul(1.1).add(0.25)
  const veins = band(main.div(thickness), width).mul(swell.smoothstep(0.1, 0.6))
  // A thinner companion vein beside the main ones, as where the stone cracked twice.
  const companion = band(meters(noise(qu.mul(1.2), qv.mul(2.8), s.add(8)).add(jag)), width.mul(0.5)).mul(unit(noise(qu.mul(0.8), qv.mul(0.8), s.add(9))).smoothstep(0.55, 0.85))
  // The fracture web: edges between Worley cells, warped once more at a finer scale so they crack crookedly instead of running straight.
  // Drifting stone cracks along its bedding, so its cells are drawn out along the veins.
  const cellU = qu.mul(drift ? 1.7 : 3.2).add(jag.mul(5))
  const cellV = qv.mul(drift ? 5 : 3.2).add(noise(qu.mul(6), qv.mul(6), s.add(17)).mul(0.14))
  const cells = mx_worley_noise_vec2(vec2(cellU, cellV).add(vec2(s, s.mul(0.37))), 1)
  const webPresence = unit(noise(qu.mul(1.1), qv.mul(1.1), s.add(10))).smoothstep(0.2, 0.6)
  // Strands differ in strength: some are bright, most are faint.
  const webStrength = unit(noise(qu.mul(3.4), qv.mul(3.4), s.add(18))).smoothstep(0.2, 0.8).mul(0.55).add(0.45)
  const cellEdge = meters(cells.y.sub(cells.x)).toVar(`${name}CellEdge`)
  // Strand weight varies along each strand, and every strand bleeds a feathered fringe into the stone.
  const strand = cellEdge.div(unit(noise(qu.mul(7), qv.mul(7), s.add(21))).mul(1.4).add(0.3))
  const web = band(strand, width.mul(0.5)).max(band(strand, width.mul(1.6)).mul(0.3)).mul(webPresence).mul(webStrength)
  // The fractures stain the stone around them, so the web sits in a soft cloud of its own color.
  const webHalo = cellEdge.abs().smoothstep(0, 0.035).oneMinus().mul(webPresence).mul(0.5)
  // A second, finer web of hairlines fills the patches between, so the fractures branch at every scale.
  const fineCells = mx_worley_noise_vec2(vec2(qu.mul(8).add(jag.mul(16)), qv.mul(8).add(cellV.mul(0.3))).add(vec2(s.mul(0.71), s)), 1)
  const finePresence = unit(noise(qu.mul(1.7), qv.mul(1.7), s.add(19))).smoothstep(0.15, 0.6)
  const fineWeb = line(meters(fineCells.y.sub(fineCells.x)), 0.0007).mul(finePresence).mul(webStrength.mul(0.85)).mul(visibleDetail(footprint, 0.03))
  // And loose threads, close up only.
  const threads = line(meters(noise(qu.mul(2.5), qv.mul(6.5), s.add(11)).add(jag)), 0.0006).mul(unit(noise(qu.mul(1.5), qv.mul(1.5), s.add(12))).smoothstep(0.62, 0.85)).mul(visibleDetail(footprint, 0.01))
  return {
    clouds,
    halo,
    veins: veins.max(companion).toVar(`${name}Veins`),
    web: web.toVar(`${name}Web`),
    webHalo,
    hairlines: fineWeb.max(threads).toVar(`${name}Hairlines`),
  }
}

/** Colors a marble pattern in one cut of stone. Returns the albedo and the vein coverage, as veins are filled and polish slightly differently. */
export function shadeMarble(pattern: MarblePattern, style: MarbleStyle) {
  const web = pattern.web.mul(style.web)
  let stone = mix(color(style.base), color(style.cloud), pattern.clouds)
  stone = mix(stone, color(style.halo), pattern.halo.max(pattern.webHalo.mul(style.web)).mul(style.haloStrength))
  stone = mix(stone, color(style.thread), pattern.hairlines.mul(style.web).mul(style.threadStrength))
  stone = mix(stone, color(style.vein), web.max(pattern.veins))
  return {
    color: stone,
    vein: pattern.veins.max(web),
  }
}

/** Procedural polished marble in one cut of stone; see `marblePattern` and `shadeMarble`. */
export function marble({style, ...options}: Omit<Parameters<typeof marblePattern>[0], 'veinWidth'> & {style: MarbleStyle}) {
  return shadeMarble(marblePattern({
    ...options,
    veinWidth: style.veinWidth,
  }), style)
}
