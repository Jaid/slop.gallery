import Mood from '../base/Mood.ts'
import ImpastoAmbience from './ImpastoAmbience.ts'

/** The Impasto Orb’s thick paint: raking warm light over deep violet-brown shadow, so every surface reads as relief, laden and sculptural. */
export default class ImpastoMood extends Mood {
  override readonly ambience = ImpastoAmbience
  override readonly fill = {
    color: '#cfd0ff',
    gain: 0.85,
  }
  override readonly grade = {
    shadow: '#241428',
    midtone: '#a8762e',
    highlight: '#ffe9bb',
    strength: 0.5,
  }
  readonly id = 'impasto'
  override readonly lamps = {
    color: '#ffdf9e',
    gain: 1.15,
  }
  readonly title = 'Impasto'
}
