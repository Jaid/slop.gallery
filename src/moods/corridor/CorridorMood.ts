import hsl from 'okhsl'

import reverberation from '#src/lib/audio/transformers/reverberation.ts'

import RoomMood from '../base/RoomMood.ts'

/** The Corridor’s own: a timber tunnel with a flutter of its own, where the dark between the lanterns deepens while their glow holds and the view widens, so the long way back looks longer still. */
export default class CorridorMood extends RoomMood {
  override readonly fov = 10
  // The dark between the lanterns deepens, while their glow holds.
  override readonly grade = {
    shadow: hsl.integer(58, 37, 2),
    midtone: hsl.integer(61, 35, 32),
    highlight: hsl.integer(67, 100, 95),
    strength: 0.3,
  }
  readonly id = 'corridor'
  readonly title = 'Timber tunnel'
  // A timber tunnel with a flutter of its own.
  override readonly transformer = reverberation({
    decay: 1.1,
    predelay: 0.005,
    brightness: [5500, 1600],
    flutter: [0.017, 6, 0.35],
    wet: 0.17,
  })
}
