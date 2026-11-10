import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Antechamber’s own: a small room under a tall plaster dome, which sends a sound back down from its crown. */
export default class AntechamberMood extends RoomMood {
  readonly id = 'antechamber'
  readonly title = 'Plaster dome'
  // A small room under a tall plaster dome, which sends a sound back down from its crown.
  override readonly transformer = reverberation({
    decay: 1.9,
    predelay: 0.012,
    brightness: [8000, 2200],
    early: [[0.04, 0.38], [0.08, 0.2]],
    wet: 0.19,
  })
}
