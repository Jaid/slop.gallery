import Mood from '../base/Mood.ts'
import PaintAmbience from './PaintAmbience.ts'
import TideLines from './TideLines.ts'

/** The Paint Orb’s Atelier: the sound of a quiet studio while watercolor washes bloom in the corners of the view. */
export default class PaintMood extends Mood {
  override readonly ambience = PaintAmbience
  override readonly fade = {
    in: 3.5,
    out: 1,
  }
  readonly id = 'paint'
  override readonly screen = new TideLines(this.fade.in)
  readonly title = 'Atelier'
}
