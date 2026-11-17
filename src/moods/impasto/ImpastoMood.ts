import Mood from '../base/Mood.ts'
import ImpastoAmbience from './ImpastoAmbience.ts'

/** The Impasto Orb’s relief: dramatic warm raking light over cool twilight shadows, sharpening every surface into bold chiaroscuro. */
export default class ImpastoMood extends Mood {
  override readonly ambience = ImpastoAmbience
  override readonly fill = {
    color: '#ced8f2',
    gain: 0.85,
  }
  override readonly grade = {
    shadow: '#1b110c',
    midtone: '#b36b30',
    highlight: '#fff0c4',
    strength: 0.45,
  }
  readonly id = 'impasto'
  override readonly lamps = {
    color: '#ffc670',
    gain: 1.15,
  }
  readonly title = 'Impasto'
}
