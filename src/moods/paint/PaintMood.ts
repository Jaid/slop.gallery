import Mood from '../base/Mood.ts'
import PaintAmbience from './PaintAmbience.ts'
import {paintScreen} from './PaintScreen.ts'

/** The Paint Orb’s atelier: oil brush strokes paint a living vignette around the viewer’s screen without recoloring the gallery itself. */
export default class PaintMood extends Mood {
  override readonly ambience = PaintAmbience
  readonly id = 'paint'
  override readonly screen = paintScreen
  readonly title = 'Atelier'
}
