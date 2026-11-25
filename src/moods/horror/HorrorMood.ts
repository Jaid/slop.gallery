import hsl from 'okhsl'

import Mood from '../base/Mood.ts'
import HorrorAmbience from './HorrorAmbience.ts'

/** The Horror Orb’s dread: the light thickens to blood and the shadows to clotted black. */
export default class HorrorMood extends Mood {
  override readonly ambience = HorrorAmbience
  override readonly fill = {
    color: hsl.integer(27, 100, 59),
    gain: 0.4,
  }
  override readonly grade = {
    shadow: hsl.integer(10, 100, 3),
    midtone: hsl.integer(26, 97, 27.5),
    highlight: hsl.integer(32, 100, 85),
    strength: 0.55,
  }
  readonly id = 'horror'
  override readonly lamps = {
    color: hsl.integer(28, 100, 60.4),
    gain: 0.6,
  }
  readonly title = 'Dread'
}
