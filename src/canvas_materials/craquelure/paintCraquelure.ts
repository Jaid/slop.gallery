import type {Amount, CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, cos, float, mix, mx_noise_float, sin, step, vec2, vec3} from 'three/tsl'

import {insideBy, slopeNormal} from '#src/lib/materials/filters.ts'

import {amountNode} from '../lib/canvasSurface.ts'
import crackCell, {cellRandom} from './crackCell.ts'

/** what the varnish has aged into: the material’s fields, or the proof editor’s sliders */
export type CraquelureKnobs = {
  /** how wide the cracks are, against what they were made with */
  cracks: Amount
  /** how far the islands curl up at their edges and tilt, against what they were made with */
  cupping: Amount
  /** how large the islands are against the size they were made at, which the position is divided by already */
  scale: Amount
  /** how far the varnish has yellowed, from clear at 0 to deep amber at 1 */
  varnish: Amount
}
type Float = Node<'float'>

/** how wide and how high the cells of the two crack networks are at scale 1, in meters: one wide, so its cracks run mostly across, the other tall, so its cracks run mostly up, which together break the film into rough quadrilaterals */
const across = [0.013, 0.0065] as const
const upward = [0.0065, 0.013] as const
/** an island’s typical size at scale 1, in meters */
export const islandSize = 0.0065
/** how far the cracks wander from straight lines at scale 1, in meters, and over how long a run */
const wander = 0.0025
const wanderSpan = 0.025
/** the share of the upward network’s cells that draw their side of a crack, so some of its cracks end against the others */
const upwardShare = 0.75
/** half a crack’s width at scale 1, in meters */
const crackHalfWidth = 0.00008
/** how high an island’s edges curl up over its middle at scale 1, in meters */
const cupHeight = 0.00007
/** how far into an island its edges curl, in meters at scale 1 */
const cupReach = islandSize * 0.38
/** the steepest an island tilts as a whole, in meters per meter */
const tiltSlope = 0.022
/** how much the varnish pools and thins, around its mean thickness */
const pooling = 0.6
/** Where in a network of cells `size` large the point lies: the cell, how far in from its nearest edge in meters and the direction toward that edge. */
function crackNetwork(at: Node<'vec2'>, size: readonly [number, number], offset: number) {
  const cell = crackCell(at.div(vec2(...size)).add(offset)).toVar()
  // An edge’s normal in the lattice turns into meters by the lattice’s size, and its distance with it.
  const normal = vec2(cos(cell.w), sin(cell.w)).div(vec2(...size))
  return {
    cell: cell.xy,
    inset: cell.z.div(normal.length()),
    toward: normal.normalize(),
  }
}
/** The share of a pixel `pixel` wide a crack of `halfWidth` on this side of the edge covers at `inset` from it, never narrower than the pixel, but as dark over it as the crack is wide. */
const crackCoverage = (inset: Float, halfWidth: Float, pixel: Float) => insideBy(inset.sub(halfWidth.max(pixel.mul(0.5))), pixel).mul(halfWidth.mul(2).div(pixel).min(1))

/**
 * Aged oil paint under yellowed varnish: the film has broken into islands a few millimeters across, each curling up at its edges and tilting its own way, with grime in the cracks between them.
 *
 * A film cracks one crack at a time, each new one stopping at those before it, so its cracks meet in T- and X-junctions rather than the Y-junctions of cells that grow at once. Two networks of cells make that: one wide, whose cracks run mostly across, one tall, whose cracks run mostly up and of which some never opened, both wandering a little the same way. A crack is drawn on each side of its edge from the exact distance to it, never narrower than a pixel but no darker over it than its width allows, so from afar the network settles into its average tone. The cupping and the tilts are exact slopes, so every island catches the lamp at an angle of its own without screen-space derivatives, which would light the cracks’ jumps.
 */
export default function paintCraquelure(material: MeshPhysicalNodeMaterial, {fine, footprint, image, position}: CanvasSurface, knobs: CraquelureKnobs) {
  const cracks = amountNode(knobs.cracks)
  const cupping = amountNode(knobs.cupping)
  const varnish = amountNode(knobs.varnish)
  // A pixel’s span in units of the position.
  const pixel = footprint.div(knobs.scale).toVar('craquelurePixel')
  const warped = position.add(vec2(mx_noise_float(position.mul(1 / wanderSpan)), mx_noise_float(position.mul(1 / wanderSpan).add(17.3))).mul(wander)).add(vec2(mx_noise_float(position.mul(8 / wanderSpan)), mx_noise_float(position.mul(8 / wanderSpan).add(8.1))).mul(wander * 0.15)).toVar('craquelureWarped')
  const wide = crackNetwork(warped, across, 0)
  const tall = crackNetwork(warped, upward, 5.7)
  // Some of the upward cells never cracked from their neighbors, so their cracks end against the others.
  const opened = step(cellRandom(tall.cell, 1).x, upwardShare)
  // Each island’s side of a crack opened as far as it pulled away, so cracks run uneven.
  const halfWidth = (cell: Node<'vec2'>) => cracks.mul(crackHalfWidth).mul(cellRandom(cell, 2).x.mul(0.9).add(0.55))
  const crack = crackCoverage(wide.inset, halfWidth(wide.cell), pixel).max(crackCoverage(tall.inset, halfWidth(tall.cell).mul(opened), pixel)).toVar('craquelureCrack')
  // An island is where a cell of each network overlap; it curls up toward the nearer crack that opened.
  const tallInset = opened.greaterThan(0.5).select(tall.inset, float(1))
  const nearer = wide.inset.lessThan(tallInset)
  const inset = nearer.select(wide.inset, tallInset)
  const toward = nearer.select(wide.toward, tall.toward)
  // The edges curl up as cupHeight·(1 − s)², s the smoothstep of the distance into the island over cupReach, so the slope rises toward the nearest crack.
  const reach = inset.div(cupReach).clamp()
  const curl = reach.oneMinus().mul(reach).mul(6).mul(reach.mul(reach).mul(reach.mul(-2).add(3)).oneMinus()).mul(2 * cupHeight / cupReach)
  const tilt = cellRandom(wide.cell.add(tall.cell.mul(vec2(37, 91)))).xy.sub(0.5).mul(2 * tiltSlope)
  const slope = toward.mul(curl).add(tilt).mul(cupping).mul(fine(islandSize)).mul(crack.oneMinus())
  const thickness = mx_noise_float(position.mul(9)).mul(0.7).add(mx_noise_float(position.mul(23)).mul(0.3)).mul(pooling).add(1)
  const aged = mix(vec3(1), color(hsl.integer(78, 82, 78)), varnish.mul(thickness).clamp())
  // Grime as dark as old paint’s mid-shadows: it darkens light paint and lightens black.
  material.colorNode = mix(image.mul(aged), color(hsl.integer(62, 30, 22)), crack.mul(0.85))
  material.normalNode = slopeNormal(slope)
  material.roughnessNode = mix(float(0.38), float(0.86), crack)
  material.clearcoatNode = crack.oneMinus().mul(0.7)
  material.clearcoatRoughness = 0.1
  material.clearcoatNormalNode = slopeNormal(slope)
}
