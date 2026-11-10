import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Vesper’s own: parquet and plaster under a coved ceiling, warm and medium. */
export default class VesperMood extends RoomMood {
  readonly id = 'vesper'
  readonly title = 'Coved parquet'
  // Parquet and plaster under a coved ceiling: warm and medium.
  override readonly transformer = reverberation({
    decay: 1.5,
    predelay: 0.016,
    brightness: [7000, 1900],
    early: [[0.012, 0.38], [0.026, 0.24]],
    wet: 0.17,
  })
}
