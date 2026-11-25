import hsl from 'okhsl'

import Mood from '../base/Mood.ts'
import HalloweenAmbience from './HalloweenAmbience.ts'

/** The Halloween Orb’s night out: purple dusk in the shadows, jack-o’-lantern orange in the lights. */
export default class HalloweenMood extends Mood {
  override readonly ambience = HalloweenAmbience
  override readonly fill = {
    color: hsl.integer(291, 100, 55),
    gain: 1,
  }
  override readonly grade = {
    shadow: hsl.integer(297, 80, 10),
    midtone: hsl.integer(313, 69, 39),
    highlight: hsl.integer(68, 100, 78.6),
    strength: 0.5,
  }
  readonly id = 'halloween'
  override readonly lamps = {
    color: hsl.integer(62, 99, 75),
    gain: 1,
  }
  readonly title = 'Halloween night'
}
