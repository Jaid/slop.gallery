import Mood from '../base/Mood.ts'
import PaintAmbience from './PaintAmbience.ts'
import PaintScreen from './PaintScreen.ts'

/** The Paint Orb’s atelier: as it comes over the world, unseen brushes paint a vignette of oil strokes into the corners of the view, which dries away into bristle streaks as it leaves, while the hush of a studio sounds. The world itself keeps its colors. */
export default class PaintMood extends Mood {
  override readonly ambience = PaintAmbience
  /** The brushes take their time laying the strokes, and the strokes take a moment to dry away, slower than other moods leave, so their bristle streaks can be seen breaking up. */
  override readonly fade = {
    in: 3.5,
    out: 1,
  }
  readonly id = 'paint'
  override readonly screen = new PaintScreen
  readonly title = 'Atelier'
}
