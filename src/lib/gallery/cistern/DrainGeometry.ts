import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, PlaneGeometry} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {climbDrain} from '../climb.ts'

/** how deep the sump under the grate is, under the floor, within the paving’s slab, whose faces round the hole cut through it line the sump */
export const sumpDepth = 0.18
/** how far under the floor the water stands in the sump */
const sumpWater = 0.13
/** how wide the grate’s frame is and how thick its iron */
const [frame, iron] = [0.035, 0.03] as const
/** how wide its bars are, how far apart they stand at most, middle to middle */
const [bar, barPitch] = [0.012, 0.045] as const
/** how thick the stone at the sump’s bottom is */
const bottom = 0.04
/** A box of the size with its middle at the position. */
function box([width, height, depth]: readonly [number, number, number], [x, y, z]: readonly [number, number, number]) {
  const geometry = new BoxGeometry(width, height, depth)
  return geometry.translate(x, y, z)
}

/**
 * The drain in the approach’s floor in front of the culvert, see `climbDrain`: an iron grate lying flush with the paving, its bars running toward the culvert in a frame, over a sump the paving is cut round, with dark water standing in it.
 * Only for the eye: the paving’s collider runs on under it, so whatever rolls out of the culvert rolls over it. In the world’s frame.
 */
export default class DrainGeometry {
  readonly grate: BufferGeometry
  /** the stone at the sump’s bottom */
  readonly sump: BufferGeometry
  readonly water: BufferGeometry

  constructor() {
    const {center: [x, z], size: [width, depth]} = climbDrain
    const top = -iron / 2
    const inner = [width - frame * 2, depth - frame * 2] as const
    const count = Math.ceil(inner[0] / barPitch) - 1
    this.grate = mergeParts([
      box([width, iron, frame], [x, top, z - depth / 2 + frame / 2]),
      box([width, iron, frame], [x, top, z + depth / 2 - frame / 2]),
      box([frame, iron, inner[1]], [x - width / 2 + frame / 2, top, z]),
      box([frame, iron, inner[1]], [x + width / 2 - frame / 2, top, z]),
      ...Array.from({length: count}, (_, index) => box([bar, iron, inner[1]], [x - inner[0] / 2 + inner[0] * (index + 1) / (count + 1), top, z])),
      // two flat bars across under them, carrying them
      ...[-1, 1].map(side => box([inner[0], iron / 2, frame / 2], [x, -iron * 1.25, z + side * inner[1] / 4])),
    ])
    this.sump = box([width, bottom, depth], [x, -sumpDepth - bottom / 2, z])
    const water = new PlaneGeometry(width, depth)
    this.water = water.rotateX(-Math.PI / 2).translate(x, -sumpWater, z)
  }

  dispose() {
    for (const geometry of [this.grate, this.sump, this.water]) {
      geometry.dispose()
    }
  }
}
