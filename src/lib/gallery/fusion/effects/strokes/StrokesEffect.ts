import type {AudioOutput} from '#src/lib/audio/proceduralAudio.ts'
import type {PortalFrame} from '#src/lib/gallery/fusion/portalFrame.ts'

import playBrushFlourish from '#src/lib/audio/brushFlourish.ts'

import EmergenceEffect from '../base/EmergenceEffect.ts'
import {brushStrokes, strokesDone} from './flights.ts'
import PaintedStrokes from './PaintedStrokes.ts'

/** Unseen brushes paint a flourish of broad oil strokes into the air around the portal as the result of a successful fusion flips out, ring by ring outward, swishing and plucking a rising harp run, which turn on around it, glossy and wet, until the paint runs dry and they dry away into bristle streaks. */
export default class StrokesEffect extends EmergenceEffect {
  override readonly afterglow = strokesDone
  readonly id = 'paint-strokes'

  createSprites() {
    return new PaintedStrokes(brushStrokes)
  }

  sound(audio: AudioOutput, frame: PortalFrame) {
    playBrushFlourish(audio, frame, brushStrokes)
  }
}
