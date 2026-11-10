import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Oculus’ own: a round tower, whose curved wall throws a ring back. */
export default class OculusMood extends RoomMood {
  readonly id = 'oculus'
  readonly title = 'Round tower'
  // A round tower, whose curved wall throws a ring back.
  override readonly transformer = reverberation({
    decay: 2.8,
    predelay: 0.028,
    brightness: [7000, 1800],
    early: [[0.09, 0.45], [0.18, 0.22], [0.27, 0.1]],
    wet: 0.22,
  })
}
