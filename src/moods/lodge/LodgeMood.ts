import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Lodge’s own: timber and fieldstone round a fire, short and warm. */
export default class LodgeMood extends RoomMood {
  readonly id = 'lodge'
  readonly title = 'Fireside'
  // Timber and fieldstone round a fire: short and warm.
  override readonly transformer = reverberation({
    decay: 0.85,
    predelay: 0.007,
    brightness: [5000, 1500],
    early: [[0.006, 0.4], [0.014, 0.3]],
    wet: 0.15,
  })
}
