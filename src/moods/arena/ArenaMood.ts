import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Arena’s own: marble underfoot and velvet round the walls of a hall. */
export default class ArenaMood extends RoomMood {
  readonly id = 'arena'
  readonly title = 'Marble hall'
  // Marble underfoot and velvet round the walls of a hall.
  override readonly transformer = reverberation({
    decay: 1.6,
    predelay: 0.02,
    brightness: [7000, 2000],
    early: [[0.018, 0.35], [0.04, 0.22]],
    wet: 0.17,
  })
}
