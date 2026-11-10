import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'
import BastionAmbience from './BastionAmbience.ts'

/** The Bastion’s own: stone passages ringing dark and long, with slaps between their close walls, and drafts pressing through their iron bars. */
export default class BastionMood extends RoomMood {
  override readonly ambience = BastionAmbience
  readonly id = 'bastion'
  readonly title = 'Cold stone'
  // Stone passages: dark and long, with slaps between their close walls.
  override readonly transformer = reverberation({
    decay: 2.7,
    predelay: 0.009,
    brightness: [6000, 1200],
    flutter: [0.024, 7, 0.45],
    wet: 0.26,
  })
}
