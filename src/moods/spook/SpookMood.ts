import hsl from 'okhsl'

import Mood from '../base/Mood.ts'
import SpookAmbience from './SpookAmbience.ts'

/** The Spook Orb’s haunting: everything drowns in a sickly ghost-light green. */
export default class SpookMood extends Mood {
  override readonly ambience = SpookAmbience
  override readonly fill = {
    color: hsl.integer(159, 100, 91.5),
    gain: 0.75,
  }
  override readonly grade = {
    shadow: hsl.integer(165, 76, 15),
    midtone: hsl.integer(163, 63, 64),
    highlight: hsl.integer(161, 100, 97.2),
    strength: 0.5,
  }
  readonly id = 'spook'
  override readonly lamps = {
    color: hsl.integer(157, 100, 93.9),
    gain: 0.85,
  }
  readonly title = 'Haunting'
}
