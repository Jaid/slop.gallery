import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {float, max, smoothstep} from 'three/tsl'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {legible, repeatPhase} from '../lib/materials/carving.ts'
import FrameWoodMaterial, {pine, walnut} from '../lib/materials/FrameWoodMaterial.ts'

// The picture lies under the lowest layer, which reaches in over its edge.
type Float = Node<'float'>

const imageDepth = -0.089
const dark = 0
const light = 1
/** the layers of the stack from the wall up: how far in each one reaches, alternating dark and light woods */
const layers = [
  {
    from: 0,
    to: 0.106,
    z: -0.083,
  },
  {
    from: 0.012,
    to: 0.094,
    z: -0.071,
  },
  {
    from: 0.024,
    to: 0.082,
    z: -0.059,
  },
  {
    from: 0.036,
    to: 0.07,
    z: -0.047,
  },
] as const
/** strips of cigar-box wood stacked into a pyramid, each smaller than the one under it, so every layer shows a ledge of its own */
function stack() {
  const tone = (index: number) => (index % 2 === 0 ? dark : light)
  const profile = FrameProfile.from([-0.005, imageDepth], dark)
    .line(-0.005, layers[0].z)
  // Up the inside of the pyramid, a ledge of each layer and the riser of the next, across its crown, and down its outside the same way.
  for (let index = 0; index < layers.length - 1; index++) {
    profile.line(layers[index + 1].from, layers[index].z, {material: tone(index)})
      .line(layers[index + 1].from, layers[index + 1].z, {material: tone(index + 1)})
  }
  const crown = layers.length - 1
  profile.line(layers[crown].to, layers[crown].z, {material: tone(crown)})
  for (let index = layers.length - 2; index >= 0; index--) {
    profile.line(layers[index + 1].to, layers[index].z, {material: tone(index + 1)})
      .line(layers[index].to, layers[index].z, {material: tone(index)})
  }
  return profile.line(layers[0].to, frameBack, {material: dark}).line(-0.005, frameBack)
}
const profile = stack()
/** Chip carving along the edges of every layer: V notches cut side by side into its arrises, as a hobo’s pocketknife cut them. */
function notches(surface: FrameSurface) {
  let height: Float = float(0)
  for (const layer of layers) {
    for (const edge of [layer.from, layer.to]) {
      const near = smoothstep(0.009, 0.001, surface.reach.sub(edge).abs())
      const phase = repeatPhase(surface, 0.014, edge)
      const vee = phase.sub(0.5).abs().mul(2)
      height = max(height, near.mul(vee.oneMinus()))
    }
  }
  return legible(surface, height, 0.006).mul(-0.006)
}

/** The Lodge’s: tramp art, a pyramid of cigar-box strips stacked in alternating woods, every edge chip-carved with notches. */
export default class TrampFrame extends PortraitFrame {
  override readonly description = 'Tramp art, whittled by the fire: strips of cigar-box wood stacked into a pyramid of four layers, alternating dark walnut and pale pine, every edge of every layer chip-carved with V notches by a pocketknife, so the whole frame bristles like a pinecone.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#8a6a44'
  override readonly title = 'Tramp art'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new FrameWoodMaterial({
        timber: walnut,
        gloss: 0.2,
        roughness: 0.55,
        relief: notches,
      }),
      new FrameWoodMaterial({
        timber: {
          ...pine,
          knots: 0,
        },
        gloss: 0.2,
        roughness: 0.55,
        stain: '#e0b380',
        relief: notches,
      }),
    ]
  }
}
