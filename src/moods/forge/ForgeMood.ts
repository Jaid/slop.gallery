import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Forge’s own: glazed brick under a sawtooth roof, its round vestibule ringing faintly. */
export default class ForgeMood extends RoomMood {
  readonly id = 'forge'
  readonly title = 'Sawtooth brick'
  // Glazed brick under a sawtooth roof, its round vestibule ringing faintly.
  override readonly transformer = reverberation({
    decay: 1.8,
    predelay: 0.018,
    brightness: [7500, 2000],
    early: [[0.03, 0.3], [0.06, 0.18]],
    wet: 0.18,
  })
}
