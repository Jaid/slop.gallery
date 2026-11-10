import Mood from '../base/Mood.ts'
import HalloweenAmbience from './HalloweenAmbience.ts'

/** The Halloween Orb’s night out: purple dusk in the shadows, jack-o’-lantern orange in the lights. */
export default class HalloweenMood extends Mood {
  override readonly ambience = HalloweenAmbience
  override readonly fill = {
    color: '#8a5cff',
    gain: 1,
  }
  override readonly grade = {
    shadow: '#1c0838',
    midtone: '#7a3a9a',
    highlight: '#ffb050',
    strength: 0.5,
  }
  readonly id = 'halloween'
  override readonly lamps = {
    color: '#ffa040',
    gain: 1,
  }
  readonly title = 'Halloween night'
}
