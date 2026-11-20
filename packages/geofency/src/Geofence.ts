import type {Box, BoxInput} from './box/index.ts'
import type {Fence, Position} from './types.ts'

import {createBox, subtractBox} from './box/index.ts'

/** a space fenced by the union of one or more boxes */
export default class Geofence implements Fence {
  readonly boxes: ReadonlyArray<Box>

  /** Takes boxes or their plain data, see {@link createBox}. */
  constructor(boxes: ReadonlyArray<Box | BoxInput>) {
    if (!boxes.length) {
      throw new RangeError('A geofence needs at least one box.')
    }
    this.boxes = Object.freeze(boxes.map(box => createBox(box)))
  }

  /** Whether any of the boxes contains the position. */
  contains(position: Position) {
    return this.boxes.some(box => box.contains(position))
  }

  /** Whether the two fences share any space: more than faces, edges or corners, which is all that fences side by side share, like those of two rooms on either side of a wall. */
  overlaps(fence: Geofence) {
    return this.boxes.some(box => fence.boxes.some(other => box.overlaps(other)))
  }

  /** A new geofence around whatever of this one lies outside of the other one, or null if the other one covers all of it. */
  subtract(fence: Geofence) {
    const boxes = fence.boxes.reduce<ReadonlyArray<Box>>((parts, taken) => parts.flatMap(part => subtractBox(part, taken)), this.boxes)
    return boxes.length ? new Geofence(boxes) : null
  }

  /** A new geofence with every box moved by the offset, like from a room’s relative fence to its world fence. */
  translate(offset: Position) {
    return new Geofence(this.boxes.map(box => box.translate(offset)))
  }
}
