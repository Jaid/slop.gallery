import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Cell’s own: varnished wood and papered walls under a coffered ceiling, short and soft. */
export default class CellMood extends RoomMood {
  readonly id = 'cell'
  readonly title = 'Varnished wood'
  // Varnished wood and papered walls under a coffered ceiling: short and soft.
  override readonly transformer = reverberation({
    decay: 1,
    predelay: 0.012,
    brightness: [6000, 1700],
    early: [[0.011, 0.33], [0.024, 0.2]],
    wet: 0.14,
  })
}
