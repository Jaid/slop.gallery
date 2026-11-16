import Mood from '../base/Mood.ts'
import ImpastoAmbience from './ImpastoAmbience.ts'

/** The Impasto Orb’s dusk: the world turns into a thickly painted evening, deep teal and Prussian blue in the shadows, glowing amber in the lights. */
export default class ImpastoMood extends Mood {
  override readonly ambience = ImpastoAmbience
  override readonly fill = {
    color: '#b8e2e4',
    gain: 0.85,
  }
  override readonly grade = {
    shadow: '#0d2a3c',
    midtone: '#c0703a',
    highlight: '#ffe2a8',
    strength: 0.5,
  }
  readonly id = 'impasto'
  override readonly lamps = {
    color: '#ffc27a',
    gain: 1.15,
  }
  readonly title = 'Knifework'
}
