import hsl from 'okhsl'

import Mood from '../base/Mood.ts'
import FrostAmbience from './FrostAmbience.ts'
import FrostScreen from './FrostScreen.ts'

/** The Frost Orb’s deep freeze: gallery lamps chill into arctic blue-white, crystalline hoarfrost ferns creep inward from the corners of the view with sparkling diamond-dust glints and blowing spindrift, and arctic wind howls faintly over cracking ice. */
export default class FrostMood extends Mood {
  override readonly ambience = FrostAmbience
  override readonly fade = {
    in: 2.6,
    out: 1,
  }
  override readonly fill = {
    color: hsl.integer(232, 78, 86),
    gain: 0.78,
  }
  override readonly grade = {
    shadow: hsl.integer(238, 74, 14),
    midtone: hsl.integer(225, 52, 66),
    highlight: hsl.integer(218, 88, 97),
    strength: 0.34,
  }
  readonly id = 'frost'
  override readonly lamps = {
    color: hsl.integer(226, 72, 92),
    gain: 0.85,
  }
  override readonly screen = new FrostScreen(this.fade.in)
  readonly title = 'Deep Freeze'
}
