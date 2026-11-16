import Mood from '../base/Mood.ts'
import ImpastoAmbience from './ImpastoAmbience.ts'

/** A warm, raking studio light over cool shadows, with the atelier’s quiet brush and palette-knife sounds. */
export default class ImpastoMood extends Mood {
  override readonly ambience = ImpastoAmbience
  override readonly fill = {
    color: '#d5e1ee',
    gain: 0.85,
  }
  override readonly grade = {
    shadow: '#17263b',
    midtone: '#b77b50',
    highlight: '#ffe9b2',
    strength: 0.38,
  }
  readonly id = 'impasto'
  override readonly lamps = {
    color: '#ffe1ae',
    gain: 1.2,
  }
  readonly title = 'Impasto atelier'
}
