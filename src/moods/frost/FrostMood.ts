import hsl from 'okhsl'

import Mood from '../base/Mood.ts'
import FrostAmbience from './FrostAmbience.ts'
import Hoarfrost from './Hoarfrost.ts'

/** The Frost Orb’s blizzard: the world turns to a winter night, its shadows deep blue and its lights gone cold and pale, while hoarfrost creeps over the view from its edges, snow blows across it and the wind howls round the walls. */
export default class FrostMood extends Mood {
  override readonly ambience = FrostAmbience
  /** The frost takes its time to creep in and melts back a little more quickly. */
  override readonly fade = {
    in: 3,
    out: 1.2,
  }
  override readonly fill = {
    color: hsl.integer(240, 85, 82),
    gain: 0.9,
  }
  override readonly grade = {
    shadow: hsl.integer(268, 85, 9),
    midtone: hsl.integer(246, 55, 52),
    highlight: hsl.integer(220, 45, 97),
    strength: 0.5,
  }
  readonly id = 'frost'
  override readonly lamps = {
    color: hsl.integer(236, 60, 90),
    gain: 0.85,
  }
  override readonly screen = new Hoarfrost
  readonly title = 'Blizzard'
}
