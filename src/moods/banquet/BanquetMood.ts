import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Banquet’s own: polished marble checker under a hard ceiling, bright and lively. */
export default class BanquetMood extends RoomMood {
  readonly id = 'banquet'
  readonly title = 'Marble checker'
  // Polished marble checker under a hard ceiling: bright and lively.
  override readonly transformer = reverberation({
    decay: 1.7,
    predelay: 0.017,
    brightness: [8500, 2400],
    early: [[0.013, 0.42], [0.029, 0.28]],
    wet: 0.18,
  })
}
