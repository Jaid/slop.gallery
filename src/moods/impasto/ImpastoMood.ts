import Mood from '../base/Mood.ts'
import ImpastoAmbience from './ImpastoAmbience.ts'
import ImpastoScreen from './ImpastoScreen.ts'

/** The Impasto Orb’s workshop: as it comes over the world, unseen brushes paint a vignette of oil strokes into the corners of the view and go on painting for as long as it holds, laying every stroke again once it has dried away; as it leaves, all of them dry away into bristle streaks, while a palette knife trowels paste across linen. The world itself keeps its colors. */
export default class ImpastoMood extends Mood {
  override readonly ambience = ImpastoAmbience
  /** The brushes take their time laying the strokes, and the strokes take a moment to dry away, slower than other moods leave, so their bristle streaks can be seen breaking up. */
  override readonly fade = {
    in: 3.5,
    out: 1,
  }
  readonly id = 'impasto'
  override readonly screen = new ImpastoScreen(this.fade.in)
  readonly title = 'Impasto'
}
