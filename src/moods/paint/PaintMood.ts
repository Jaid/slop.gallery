import Mood from '../base/Mood.ts'
import PaintAmbience from './PaintAmbience.ts'

/** The Paint Orb’s atelier: the world turns into a painter’s study of it, warm in the lights and cool in the shadows, like an old master would lay it out. */
export default class PaintMood extends Mood {
  override readonly ambience = PaintAmbience
  override readonly fill = {
    color: '#d4dcff',
    gain: 0.9,
  }
  readonly id = 'paint'
  override readonly lamps = {
    color: '#ffd49c',
    gain: 1.1,
  }
  override readonly screen = {
    id: 'brush-vignette',
    strength: 0.9,
  } as const
  readonly title = 'Atelier'
}
