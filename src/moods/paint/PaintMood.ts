import Mood from '../base/Mood.ts'
import brushVignette from './brushVignette.ts'
import PaintAmbience from './PaintAmbience.ts'

/** The Paint Orb’s atelier: brushes lay oil paint around the edges of the view, leaving the subject and the light on it alone. */
export default class PaintMood extends Mood {
  override readonly ambience = PaintAmbience
  readonly id = 'paint'
  readonly title = 'Atelier'
  override readonly vignette = brushVignette
}
