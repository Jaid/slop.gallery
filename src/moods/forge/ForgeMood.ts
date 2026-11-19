import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Forge’s own: hard brick, tile and iron, with a faint ring in the round vestibule. */
export default class ForgeMood extends RoomMood {
  readonly id = 'forge'
  readonly title = 'Brick and iron'
  override readonly transformer = reverberation({
    decay: 1.8,
    predelay: 0.018,
    brightness: [7500, 2000],
    early: [[0.03, 0.3], [0.06, 0.18]],
    wet: 0.18,
  })
}
