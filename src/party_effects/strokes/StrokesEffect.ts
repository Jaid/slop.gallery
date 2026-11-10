import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import playBrushFlourish from './brushFlourish.ts'
import {brushStrokes, strokeDrying, strokePoint, strokesDone} from './flights.ts'
import PaintedStrokes from './PaintedStrokes.ts'

/** Unseen brushes paint a flourish of broad oil strokes into the air around their origin, ring by ring outward, swishing and plucking a rising harp run, which turn on around it, glossy and wet, until the paint runs dry and they dry away into bristle streaks. */
export default class StrokesEffect extends PartyEffect {
  readonly duration = strokesDone
  readonly id = 'strokes'
  readonly title = 'Brush strokes'

  createSprites() {
    return new PaintedStrokes(brushStrokes)
  }

  /** Every stroke as wide as its brush, from where it was set down to where the brush lifted off, from the moment it was set down, or `since`, until it has dried away. */
  extent(_floor: number, since = 0) {
    return brushStrokes.flatMap(stroke => {
      const gone = stroke.phase * strokeDrying.stagger + strokeDrying.start + strokeDrying.seconds - stroke.delay
      return moments(Math.max(0, since - stroke.delay), gone, 4).flatMap(seconds => moments(0, 1, 6).flatMap(share => around(strokePoint(stroke, share, seconds), stroke.width / 2)))
    })
  }

  sound(audio: AudioOutput, site: PartySite) {
    playBrushFlourish(audio, site, brushStrokes)
  }
}
