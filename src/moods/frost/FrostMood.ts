import hsl from 'okhsl'

import Mood from '../base/Mood.ts'
import FrostAmbience from './FrostAmbience.ts'

/** Polar twilight: indigo shadows and snow-bright lamps, with enough of the work’s own pigment coming through to aim by. */
export default class FrostMood extends Mood {
  override readonly ambience = FrostAmbience
  override readonly fill = {
    color: hsl.integer(244, 64, 86),
    gain: 1,
  }
  override readonly grade = {
    shadow: hsl.integer(261, 58, 13),
    midtone: hsl.integer(236, 54, 56),
    highlight: hsl.integer(190, 73, 97),
    strength: 0.48,
  }
  readonly id = 'frost'
  override readonly lamps = {
    color: hsl.integer(208, 66, 94),
    gain: 1.05,
  }
  readonly title = 'Polar twilight'
}
