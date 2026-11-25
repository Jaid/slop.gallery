import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {color, float, mix, mx_noise_float, vec2} from 'three/tsl'

import {slopeNormal} from '#src/lib/materials/filters.ts'

/** what the rag is pressed with: the material’s fields, or the proof editor’s sliders */
export type RagKnobs = {
  /** how much the cotton on the crests shows, against what it was made with */
  flecks: Amount
  /** how large the tooth is against the size it was made at, which the position is divided by already */
  scale: Amount
  /** how crisply the tooth’s crests break into its hollows, from the soft felt it was made with at 0 to edges as narrow as the pixels can draw at 1 */
  sharpness: Amount
  /** how deep the paper’s tooth is, against what it was made with */
  tooth: Amount
}
type Float = Node<'float'>

type Amount = Float | number

/** how high a sharp tooth’s crests stand and how low its hollows sink, near the felt’s own mean height, so a sharp tooth keeps as much relief and as much ink in its hollows as a soft one */
const plateau = 0.25
/** the narrowest a crest’s edge gets, in units of the felt’s height, even where a pixel could draw it finer */
const edge = 0.03
/** where the cotton starts to show on the felt, its middle sliding to keep the same share of the paper once the crests are sharp */
const fleckMiddle = [0.365, 0.32] as const
const fleckHalfWidth = 0.305
/** the nearest the slope is sampled, in units of the position, above what the noise’s precision resolves */
const nearestStep = 0.00005
const felt = (position: Node<'vec2'>) => mx_noise_float(position.mul(143)).mul(0.7).add(mx_noise_float(position.mul(vec2(85, 261))).mul(0.3))
const fibers = (position: Node<'vec2'>) => mx_noise_float(position.mul(32))

/**
 * Cold-pressed cotton rag paper: the ink settles into the tooth’s tiny hollows while flecks of cotton on its crests keep their light.
 *
 * The tooth is felt noise, sharpened by `f / (1 − a + a|f|/plateau)`, which leaves it as it is at `a = 0` and squeezes it toward flat crests and hollows parted by steep edges as `a` grows. However sharp it is asked to be, an edge is never narrower than the felt changes across a pixel, so it can’t alias. The relief tilts the normal by the slope across the pixel’s footprint, read from the felt on either side, so sharp edges stay smooth lines instead of the 2 × 2 blocks screen-space derivatives would cut them into.
 */
export default function paintRag(material: MeshPhysicalNodeMaterial, image: Node<'vec3'>, position: Node<'vec2'>, footprint: Float, fine: (size: number) => Float, {flecks, scale, sharpness, tooth}: RagKnobs) {
  const step = footprint.div(scale).max(nearestStep).toVar('ragStep')
  const around = [vec2(step, 0), vec2(step, 0).negate(), vec2(0, step), vec2(0, step).negate()].map(offset => position.add(offset))
  const middle = felt(position).toVar('ragFelt')
  const [east, west, north, south] = around.map(at => felt(at).toVar())
  const detail = fine(0.008).toVar('ragDetail')
  const sharp = typeof sharpness === 'number' ? float(sharpness) : sharpness
  // How much the felt changes across a pixel, the narrowest an edge may get.
  const narrowest = east.sub(west).abs().max(north.sub(south).abs()).mul(0.5).max(edge).toVar('ragNarrowest')
  const squeeze = sharp.mul(plateau).div(narrowest.add(plateau)).toVar('ragSqueeze')
  const shape = (f: Float) => f.div(squeeze.oneMinus().add(squeeze.mul(f.abs()).div(plateau)))
  const height = (f: Float, at: Node<'vec2'>) => shape(f).mul(detail).mul(0.00085).add(fibers(at).mul(0.0005))
  const slope = vec2(height(east, around[0]).sub(height(west, around[1])), height(north, around[2]).sub(height(south, around[3]))).div(step.mul(2).mul(scale)).mul(tooth)
  const pressed = shape(middle).mul(detail)
  const fleckAt = mix(float(fleckMiddle[0]), float(fleckMiddle[1]), sharp)
  const fleckSpread = mix(float(fleckHalfWidth), narrowest, sharp)
  const crests = middle.mul(detail).smoothstep(fleckAt.sub(fleckSpread), fleckAt.add(fleckSpread))
  material.colorNode = mix(image.mul(pressed.mul(0.12).sub(0.02).mul(tooth).add(1)), color('#ddd3be'), crests.mul(flecks).mul(0.063).min(1))
  material.normalNode = slopeNormal(slope)
  material.roughness = 0.98
}
