import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** Moonfall’s own: a crater under a dome, with the longest, darkest tail. */
export default class MoonfallMood extends RoomMood {
  readonly id = 'moonfall'
  readonly title = 'Crater dome'
  // A crater under a dome: the longest, darkest tail.
  override readonly transformer = reverberation({
    decay: 3.6,
    predelay: 0.034,
    brightness: [4200, 700],
    early: [[0.03, 0.3], [0.061, 0.22]],
    wet: 0.26,
  })
}
