import hsl from 'okhsl'

import Mood from '../base/Mood.ts'
import FrostAmbience from './FrostAmbience.ts'
import WindowFrost from './WindowFrost.ts'

/** The Frost Orb’s blizzard: the world freezes blue, window frost creeps over the view from its edges for as long as the cold holds and melts back as it leaves, and arctic wind howls round the listener. */
export default class FrostMood extends Mood {
  override readonly ambience = FrostAmbience
  /** The cold takes a little to bite, and a moment longer than most moods to melt away again. */
  override readonly fade = {
    in: 3,
    out: 1.5,
  }
  override readonly fill = {
    color: hsl.integer(233, 72, 76),
    gain: 0.78,
  }
  override readonly grade = {
    shadow: hsl.integer(252, 64, 9),
    midtone: hsl.integer(237, 48, 52),
    highlight: hsl.integer(216, 95, 96.5),
    strength: 0.45,
  }
  readonly id = 'frost'
  override readonly lamps = {
    color: hsl.integer(221, 88, 91),
    gain: 0.85,
  }
  override readonly screen = new WindowFrost(this.fade.in)
  readonly title = 'Blizzard'
}
