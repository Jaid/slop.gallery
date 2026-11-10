import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Salon’s own: terrazzo under walls hung frame to frame, whose canvases soak up the highs. */
export default class SalonMood extends RoomMood {
  readonly id = 'salon'
  readonly title = 'Hung walls'
  // Terrazzo under walls hung frame to frame, whose canvases soak up the highs.
  override readonly transformer = reverberation({
    decay: 1.2,
    predelay: 0.014,
    brightness: [6500, 1800],
    early: [[0.012, 0.32], [0.027, 0.2]],
    wet: 0.15,
  })
}
