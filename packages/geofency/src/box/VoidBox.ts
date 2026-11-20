import type {Position} from '../types.ts'

import zod from 'zod'

import Box, {footprintShape} from './base/Box.ts'

export const voidBoxInputSchema = zod.strictObject({
  ...footprintShape,
  ceiling: zod.number(),
})
export type VoidBoxInput = zod.input<typeof voidBoxInputSchema>

/** the column under its footprint from its ceiling down */
export default class VoidBox extends Box {
  readonly ceiling: number

  constructor(input: VoidBoxInput) {
    const {ceiling, ...footprint} = voidBoxInputSchema.parse(input)
    super(footprint)
    this.ceiling = ceiling
  }

  get bottom() {
    return -Infinity
  }

  get top() {
    return this.ceiling
  }

  contains(position: Position) {
    return position[1] <= this.ceiling && this.footprintContains(position)
  }

  translate(offset: Position) {
    return new VoidBox({
      ...this.translateFootprint(offset),
      ceiling: this.ceiling + offset[1],
    })
  }
}
