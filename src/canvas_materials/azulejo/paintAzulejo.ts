import type {Amount, CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, mx_noise_float, texture, uv, vec2, vec3} from 'three/tsl'

import {insideBy, slopeNormal} from '#src/lib/materials/filters.ts'

import {amountNode} from '../lib/canvasSurface.ts'

/** what the tiles are set with: the material’s fields, or the proof editor’s sliders */
export type AzulejoKnobs = {
  /** how glossy the glaze is, from a satin glaze at 0 to glassy at 1 */
  glaze: Amount
  /** how wide the grout between the tiles is, against what it was made with */
  grout: Amount
  /** how large the tiles are against the size they were made at, which the position is divided by already */
  scale: Amount
  /** how far each tile tilts and bows its own way, against what it was made with */
  warp: Amount
}
type Vec2 = Node<'vec2'>

/** how far apart the tiles are set at scale 1, grout included, in meters */
export const pitch = 0.14
/** how wide the grout is at scale 1, in meters */
export const groutWidth = 0.003
/** how far in from its edge a tile rounds down into the grout at scale 1, in meters, and how far it drops over that */
export const bevel = 0.004
const bevelDepth = 0.0007
/** the steepest a tile tilts as a whole, in meters per meter, and how far its corners stand off its middle where it bows most */
const tiltSlope = 0.012
const bowHeight = 0.001
/** how high the glaze ripples at scale 1, in meters, and across how many meters a ripple runs */
const rippleHeight = 0.00012
const rippleSpan = 0.025
/** over how many meters the glaze softened the paint as it melted */
export const melt = 0.0008

const ripple = (at: Vec2) => mx_noise_float(at.mul(1 / rippleSpan)).mul(rippleHeight)

/**
 * Painted tin-glazed tiles: the picture is painted across a grid of square tiles, set in grout, each tilted and bowed a little its own way by the kiln, so each mirrors the lamp and the room on its own.
 *
 * The tile in the image’s middle is centered on it. A tile rounds down into the grout at its edges, where the glaze thins over the pale clay. The grout and the rounded edges fade into their average once narrower than a pixel, and every slope is exact, so the tiles’ edges stay crisp without screen-space derivatives.
 */
export default function paintAzulejo(material: MeshPhysicalNodeMaterial, {fine, footprint, map, position, uvPerMeter}: CanvasSurface, knobs: AzulejoKnobs) {
  const warp = amountNode(knobs.warp)
  const pixel = footprint.div(knobs.scale).toVar('azulejoPixel')
  const tile = position.div(pitch).round().toVar('azulejoTile')
  const local = position.sub(tile.mul(pitch)).toVar('azulejoLocal')
  const shape = mx_cell_noise_vec3(vec3(tile, 0))
  const firing = mx_cell_noise_vec3(vec3(tile, 1))
  const edge = local.abs()
  // How far the tile’s boundary, the grout’s middle, lies.
  const toBoundary = float(pitch / 2).sub(edge.x.max(edge.y))
  const groutHalf = amountNode(knobs.grout).mul(groutWidth / 2)
  const grout = insideBy(toBoundary.sub(groutHalf.max(pixel.mul(0.5))), pixel).mul(groutHalf.mul(2).div(pixel).min(1)).toVar('azulejoGrout')
  // The tile drops by bevelDepth·(1 − t)² over its last bevel, t from the edge in.
  const rounding = toBoundary.sub(groutHalf).max(0).div(bevel).clamp().oneMinus().mul(fine(bevel)).toVar('azulejoRounding')
  const outward = edge.x.greaterThan(edge.y).select(vec2(local.x.sign(), 0), vec2(0, local.y.sign()))
  const roundingSlope = outward.mul(rounding).mul(-2 * bevelDepth / bevel)
  const tilt = shape.xy.sub(0.5).mul(2 * tiltSlope)
  // Bowed up or down, its height off its middle bow·(r / (pitch / 2))², r from the middle, so up to bowHeight at the middles of its sides.
  const bow = shape.z.sub(0.5).mul(2 * bowHeight)
  const bowSlope = local.mul(bow.mul(2 / (pitch / 2) ** 2))
  const rippleStep = rippleSpan * 0.1
  const rippleSlope = vec2(ripple(position.add(vec2(rippleStep, 0))).sub(ripple(position.sub(vec2(rippleStep, 0)))), ripple(position.add(vec2(0, rippleStep))).sub(ripple(position.sub(vec2(0, rippleStep))))).div(2 * rippleStep)
  const slope = roundingSlope.add(tilt.add(bowSlope).mul(warp)).add(rippleSlope).mul(grout.oneMinus()).toVar('azulejoSlope')
  // The paint melted into the glaze over a millimeter, or a pixel from afar.
  const area = uvPerMeter.mul(melt).max(uv().fwidth())
  const painted = texture(map, uv()).grad(vec2(area.x, 0), vec2(0, area.y)).rgb
  // Each tile came out of the kiln a little warmer or cooler, lighter or darker.
  const fired = vec3(1).add(vec3(0.025, 0, -0.025).mul(firing.x.sub(0.5).mul(2))).mul(firing.y.sub(0.5).mul(0.06).add(1))
  const glazed = mix(painted.mul(fired), color(hsl.integer(70, 35, 82)), rounding.mul(rounding).mul(0.35))
  const groutColor = color(hsl.integer(80, 10, 64)).mul(mx_noise_float(position.mul(900)).mul(0.08).add(1))
  material.colorNode = mix(glazed, groutColor, grout)
  material.normalNode = slopeNormal(slope)
  material.roughnessNode = mix(float(0.28), float(0.95), grout)
  material.clearcoatNode = grout.oneMinus().mul(knobs.glaze)
  material.clearcoatRoughness = 0.07
  material.clearcoatNormalNode = slopeNormal(slope)
}
