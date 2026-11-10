import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Sienna’s own: a hush, as the rug and the wainscot swallow most of every sound. */
export default class SiennaMood extends RoomMood {
  readonly id = 'sienna'
  readonly title = 'Hush'
  // The rug and the wainscot swallow most of it.
  override readonly transformer = reverberation({
    decay: 0.5,
    predelay: 0.006,
    brightness: [3500, 900],
    wet: 0.1,
  })
}
