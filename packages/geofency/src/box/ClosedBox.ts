import type {Position} from '../types.ts'

import zod from 'zod'

import Box, {footprintShape} from './base/Box.ts'

export const closedBoxInputSchema = zod.strictObject({
  ...footprintShape,
  y: zod.number(),
  y2: zod.number(),
})
export type ClosedBoxInput = zod.input<typeof closedBoxInputSchema>

/** the part of the column over its footprint between the heights y and y2, in any order */
export default class ClosedBox extends Box {
  readonly y: number
  readonly y2: number

  constructor(input: ClosedBoxInput) {
    const {y, y2, ...footprint} = closedBoxInputSchema.parse(input)
    super(footprint)
    this.y = Math.min(y, y2)
    this.y2 = Math.max(y, y2)
  }

  get bottom() {
    return this.y
  }

  get top() {
    return this.y2
  }

  contains(position: Position) {
    return this.y <= position[1] && position[1] <= this.y2 && this.footprintContains(position)
  }

  translate(offset: Position) {
    return new ClosedBox({
      ...this.translateFootprint(offset),
      y: this.y + offset[1],
      y2: this.y2 + offset[1],
    })
  }
}
