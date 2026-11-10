import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Lobby’s own: marble under a glass vault, long and bright. */
export default class LobbyMood extends RoomMood {
  readonly id = 'lobby'
  readonly title = 'Glass vault'
  // Marble under a glass vault: long and bright.
  override readonly transformer = reverberation({
    decay: 2.1,
    predelay: 0.022,
    brightness: [9000, 2600],
    early: [[0.011, 0.5], [0.023, 0.35], [0.041, 0.25]],
    wet: 0.2,
  })
}
