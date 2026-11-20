import type {Fence, Position} from '../../types.ts'

import zod from 'zod'

export const footprintShape = {
  x: zod.number(),
  z: zod.number(),
  x2: zod.number(),
  z2: zod.number(),
}

/** the rectangle between the corners (x, z) and (x2, z2) on the ground, in any order */
export type FootprintInput = {
  x: number
  x2: number
  z: number
  z2: number
}

/**
 * An axis-aligned region over a rectangular footprint on the ground. Subclasses decide how far it reaches up and down.
 * The footprint’s values get sorted, so that x ≤ x2 and z ≤ z2.
 */
export default abstract class Box implements Fence {
  readonly x: number
  readonly x2: number
  readonly z: number
  readonly z2: number

  constructor({x, z, x2, z2}: FootprintInput) {
    this.x = Math.min(x, x2)
    this.x2 = Math.max(x, x2)
    this.z = Math.min(z, z2)
    this.z2 = Math.max(z, z2)
  }

  /** the height the box reaches down to, -Infinity for one without a floor */
  abstract get bottom(): number

  /** the height the box reaches up to, Infinity for one without a ceiling */
  abstract get top(): number

  /** Whether the position lies inside the box or exactly on its boundary. */
  abstract contains(position: Position): boolean

  /** Whether the position lies over the footprint or exactly on its edges, at any height. */
  protected footprintContains([x, , z]: Position) {
    return this.x <= x && x <= this.x2 && this.z <= z && z <= this.z2
  }

  /** Whether the two boxes share any space: more than a face, an edge or a corner, which is all that boxes standing side by side or on top of each other share, and all that a flat box shares with any other. */
  overlaps(box: Box) {
    return Math.max(this.x, box.x) < Math.min(this.x2, box.x2) && Math.max(this.z, box.z) < Math.min(this.z2, box.z2) && Math.max(this.bottom, box.bottom) < Math.min(this.top, box.top)
  }

  /** A copy of the box moved by the offset. */
  abstract translate(offset: Position): Box

  /** The footprint moved by the offset’s x and z. */
  protected translateFootprint([x, , z]: Position): FootprintInput {
    return {
      x: this.x + x,
      z: this.z + z,
      x2: this.x2 + x,
      z2: this.z2 + z,
    }
  }
}
