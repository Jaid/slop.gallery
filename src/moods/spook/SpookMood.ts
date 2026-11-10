import Mood from '../base/Mood.ts'
import SpookAmbience from './SpookAmbience.ts'

/** The Spook Orb’s haunting: everything drowns in a sickly ghost-light green. */
export default class SpookMood extends Mood {
  override readonly ambience = SpookAmbience
  override readonly fill = {
    color: '#a0ffcc',
    gain: 0.75,
  }
  override readonly grade = {
    shadow: '#0a2a1e',
    midtone: '#5aae88',
    highlight: '#e4fff0',
    strength: 0.5,
  }
  readonly id = 'spook'
  override readonly lamps = {
    color: '#c0ffd8',
    gain: 0.85,
  }
  readonly title = 'Haunting'
}
