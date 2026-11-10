import Mood from '../base/Mood.ts'
import HorrorAmbience from './HorrorAmbience.ts'

/** The Horror Orb’s dread: the light thickens to blood and the shadows to clotted black. */
export default class HorrorMood extends Mood {
  override readonly ambience = HorrorAmbience
  override readonly fill = {
    color: '#ff3030',
    gain: 0.4,
  }
  override readonly grade = {
    shadow: '#0e0002',
    midtone: '#7a0a10',
    highlight: '#ffc4b8',
    strength: 0.55,
  }
  readonly id = 'horror'
  override readonly lamps = {
    color: '#ff4038',
    gain: 0.6,
  }
  readonly title = 'Dread'
}
