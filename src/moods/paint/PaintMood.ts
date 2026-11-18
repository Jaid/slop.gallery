import Mood from '../base/Mood.ts'
import PaintAmbience from './PaintAmbience.ts'
import paintVignette from './paintVignette.ts'

/** The Paint Orb’s atelier: unseen brushes paint a flourish around the view without recoloring the gallery. */
export default class PaintMood extends Mood {
  override readonly ambience = PaintAmbience
  readonly id = 'paint'
  readonly title = 'Atelier'
  override readonly vignette = paintVignette
}
