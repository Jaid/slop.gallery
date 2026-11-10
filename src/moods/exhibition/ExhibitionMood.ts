import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Exhibition’s own: glass vitrines down a tunnel, bright and medium. */
export default class ExhibitionMood extends RoomMood {
  readonly id = 'exhibition'
  readonly title = 'Glass vitrines'
  // Glass vitrines down a tunnel: bright and medium.
  override readonly transformer = reverberation({
    decay: 1.4,
    predelay: 0.012,
    brightness: [10_000, 3200],
    early: [[0.008, 0.4], [0.017, 0.3]],
    wet: 0.16,
  })
}
