import type {Amount, CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {cos, float, mix, mx_cell_noise_float, mx_cell_noise_vec3, sin, step, vec2, vec3} from 'three/tsl'

import {insideBy, slopeNormal} from '#src/lib/materials/filters.ts'

import {amountNode} from '../lib/canvasSurface.ts'

/** what the glass is strewn with: the material’s fields, or the proof editor’s sliders */
export type DiamondDustKnobs = {
  /** how many of the places a grain could lie hold one, from none at 0 to all at 1 */
  density: Amount
  /** how much each grain splits the light into a color of its own, from white flashes at 0 to fully colored at 1 */
  fire: Amount
  /** how much the glue the dust sticks to follows the dark ink, from everywhere alike at 0 to only where the ink is darkest at 1 */
  glue: Amount
  /** how large the grains are against the size they were made at, which the position is divided by already */
  scale: Amount
}
type Float = Node<'float'>

const tau = 2 * Math.PI
/** how far apart the grains lie at scale 1, in meters, one at most in each square this wide */
export const grainPitch = 0.001
/** how many pixels a square spans at least, so a grain is never narrower than a couple of them: one only partly covering a pixel would mix the glass’s facet with the ink into a surface neither has, which flashes as neither does */
const pixelsPerSquare = 2.5
/** how many times the grains’ squares double at most, the coarsest standing for 4¹⁰ grains */
const levels = 10
/** the steepest a grain’s facet tilts, in meters per meter, about 14°: most lie nearly flat on the glue, so the flashes gather round the mirror direction of a light */
const steepest = 0.25
/** how rough a single grain’s facet is, and how much rougher a square standing for four times as many grains gets, so from afar more of them flash, each fainter */
const facetRoughness = 0.2
const roughening = 0.05
/** the index of refraction of the grains’ facets, a diamond’s, which mirror about 17% of the light head-on */
const facetIor = 2.42
/** The color of a phase in turns, with smooth peaks between spectral bands. */
const spectrum = (phase: Float) => vec3(0, -0.34, -0.66).add(phase).mul(tau).cos().mul(0.5).add(0.5)

/**
 * Crushed glass strewn over a silkscreen print on a coat of glue, as on Warhol’s diamond dust prints: each grain is a little facet of glass at a tilt of its own, which flashes wherever it mirrors a lamp or the room into the eye.
 *
 * The flashes come from the physical shading, each grain’s facet its own normal and roughness, so every light in the room makes them. The grains lie one at most in each square of a lattice whose squares double in size until they span a couple of pixels: from afar each flash is one grain standing for all the grains it covers, a little rougher, so the dust keeps its mean glitter instead of aliasing, and no pixel mixes a facet with the ink. Between two sizes, each square of the coarser one picks either at random, so the facets never blend into tilts no grain has.
 */
export default function paintDiamondDust(material: MeshPhysicalNodeMaterial, {footprint, image, luminance, position}: CanvasSurface, knobs: DiamondDustKnobs) {
  const pixel = footprint.div(knobs.scale).toVar('diamondDustPixel')
  const detail = pixel.mul(pixelsPerSquare / grainPitch).max(1).log2().min(levels).toVar('diamondDustDetail')
  const finest = detail.floor()
  const coarser = position.div(finest.add(1).exp2().mul(grainPitch)).floor()
  const level = finest.add(step(mx_cell_noise_float(vec3(coarser, finest.add(1).mul(7))), detail.fract())).toVar('diamondDustLevel')
  const size = level.exp2().mul(grainPitch)
  const square = position.div(size)
  const cell = square.floor()
  const local = square.fract().sub(0.5)
  const random = (stream: number) => mx_cell_noise_vec3(vec3(cell, level.mul(11).add(stream)))
  const placing = random(0)
  const shaping = random(3)
  const facing = random(6)
  // A shard: the farthest of a triangle’s three sides, turned its own way.
  const toCenter = local.sub(placing.xy.sub(0.5).mul(0.3))
  const turn = shaping.x.mul(tau)
  const side = (index: number) => toCenter.dot(vec2(cos(turn.add(index * tau / 3)), sin(turn.add(index * tau / 3))))
  const shard = side(0).max(side(1)).max(side(2)).sub(placing.z.mul(0.1).add(0.2))
  const glued = amountNode(knobs.density).mul(mix(float(1), luminance.sqrt().oneMinus(), knobs.glue))
  const grain = insideBy(shard.mul(size), pixel).mul(step(shaping.y, glued)).toVar('diamondDustGrain')
  // Tilted evenly over a disc of slopes.
  const tilt = vec2(cos(facing.x.mul(tau)), sin(facing.x.mul(tau))).mul(facing.y.sqrt().mul(steepest))
  material.colorNode = mix(image, image.mul(0.8).add(0.03), grain.mul(0.25))
  material.normalNode = slopeNormal(tilt.mul(grain))
  material.roughnessNode = mix(float(0.62), level.mul(roughening).add(facetRoughness).min(0.6), grain)
  material.iorNode = mix(float(1.5), float(facetIor), grain)
  material.specularColorNode = mix(vec3(1), spectrum(facing.z).mul(1.6).min(1), grain.mul(knobs.fire))
}
