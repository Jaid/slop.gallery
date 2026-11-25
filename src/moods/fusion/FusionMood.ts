import hsl from 'okhsl'

import {fusionTiming} from '#src/lib/gallery/fusion/timing.ts'

import Mood from '../base/Mood.ts'
import FusionAmbience from './FusionAmbience.ts'

/** The world while a fusion brews, as before a thunderstorm: the daylight and the fill sink to half and everything takes on a cold blue, while the lamps burn on as they were, so the light gathers where the portal’s own effects play. The portal brings its own strong look, so this only reminds a player far away of it. */
export default class FusionMood extends Mood {
  override readonly ambience = FusionAmbience
  /** It comes over the world while the intro pulls everything in, and once the portal has closed it lifts gently instead of snapping back. */
  override readonly fade = {
    in: fusionTiming.intro,
    out: 1.5,
  }
  override readonly fill = {
    color: hsl.integer(270, 100, 88),
    gain: 0.5,
  }
  override readonly grade = {
    shadow: hsl.integer(261, 46, 8),
    midtone: hsl.integer(264, 46, 39),
    highlight: hsl.integer(262, 100, 94),
    strength: 0.18,
  }
  readonly id = 'fusion'
  override readonly lamps = {
    color: hsl.integer(0, 0, 100),
    gain: 1,
  }
  readonly title = 'Fusion'
}
