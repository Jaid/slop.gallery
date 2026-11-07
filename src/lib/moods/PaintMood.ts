import PaintAmbience from '#src/lib/audio/ambience/moods/PaintAmbience.ts'

import Mood from './base/Mood.ts'

/** The Paint Orb’s atelier: the world turns into a painter’s study of it, warm in the lights and cool in the shadows, like an old master would lay it out. */
export default class PaintMood extends Mood {
  override readonly ambience = PaintAmbience
  override readonly fill = {
    color: '#d4dcff',
    gain: 0.9,
  }
  override readonly grade = {
    shadow: '#16204a',
    midtone: '#b8844a',
    highlight: '#fff0cc',
    strength: 0.45,
  }
  readonly id = 'paint'
  override readonly lamps = {
    color: '#ffd49c',
    gain: 1.1,
  }
  readonly title = 'Atelier'
}
