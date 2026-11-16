import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import {strokeDrying, strokePoint} from '../strokes/flights.ts'
import PaintedStrokes from '../strokes/PaintedStrokes.ts'
import {knifeDone, knifeStrokes} from './flights.ts'
import playKnifeFlourish from './knifeFlourish.ts'

/** Unseen palette knives trowel thick slabs of oil paint into the air around their origin, ring by ring outward, neighboring slabs dragged against each other, gritty and laden, which barely turn on around it, glossy and wet, until the paint runs dry and they dry away into streaks. */
export default class ImpastoEffect extends PartyEffect {
  readonly duration = knifeDone
  readonly id = 'impasto'
  readonly title = 'Palette-knife smears'

  createSprites() {
    return new PaintedStrokes(knifeStrokes)
  }

  /** Every smear as wide as its knife, from where it was set down to where the knife lifted off, from the moment it was set down, or `since`, until it has dried away. */
  extent(_floor: number, since = 0) {
    return knifeStrokes.flatMap(stroke => {
      const gone = stroke.phase * strokeDrying.stagger + strokeDrying.start + strokeDrying.seconds - stroke.delay
      return moments(Math.max(0, since - stroke.delay), gone, 4).flatMap(seconds => moments(0, 1, 6).flatMap(share => around(strokePoint(stroke, share, seconds), stroke.width / 2)))
    })
  }

  sound(audio: AudioOutput, site: PartySite) {
    playKnifeFlourish(audio, site, knifeStrokes)
  }
}
