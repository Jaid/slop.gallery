import type {Position} from '../types.ts'

import zod from 'zod'

import Box, {footprintShape} from './base/Box.ts'

export const beamBoxInputSchema = zod.strictObject(footprintShape)
export type BeamBoxInput = zod.input<typeof beamBoxInputSchema>

/** an endless vertical column over its footprint */
export default class BeamBox extends Box {
  constructor(input: BeamBoxInput) {
    super(beamBoxInputSchema.parse(input))
  }

  get bottom() {
    return -Infinity
  }

  get top() {
    return Infinity
  }

  contains(position: Position) {
    return this.footprintContains(position)
  }

  /** A copy of the box moved by the offset; a beam has no height to move. */
  translate(offset: Position) {
    return new BeamBox(this.translateFootprint(offset))
  }
}
