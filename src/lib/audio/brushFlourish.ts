import type {BrushStroke} from '../gallery/fusion/effects/strokes/flights.ts'
import type {PortalFrame} from '../gallery/fusion/portalFrame.ts'
import type {AudioOutput} from 'procedural-audio'

import {offsetPosition} from '../gallery/fusion/effects/base/portalOffset.ts'
import {strokeDrying, strokePoint} from '../gallery/fusion/effects/strokes/flights.ts'
import EffectSound from './EffectSound.ts'

/** the steps of the major pentatonic scale the harp plucks, in semitones */
const pentatonic = [0, 2, 4, 7, 9]
/** the note every ring of strokes starts its run on, in hertz: A3, D4 and A4, a ring at a time higher */
const runStarts = [220, 293.66, 440]

/**
 * The sound of a flourish of brush strokes laid around the portal of `frame`, from now on: every stroke a swish of bristles over wet paint, which swells with the brush’s speed and brightens as it goes, heard from the middle of the stroke, with a soft wet smack as the brush sets down and a harp string plucked with it, every ring of strokes a run up the pentatonic scale, the outer ones higher, all in a small, warm studio; then a dry rustle while the strokes dry away.
 * It cleans up after itself once it has rung out.
 */
export default function playBrushFlourish(output: AudioOutput, frame: PortalFrame, strokes: ReadonlyArray<BrushStroke>) {
  const sound = new EffectSound(output, frame.center, {
    brightness: 0.5,
    decay: 0.45,
    length: 1.8,
    wet: 0.3,
  })
  const {now} = sound
  for (const [index, stroke] of strokes.entries()) {
    const {delay, duration, phase, ring} = stroke
    // where in its ring’s run the stroke plucks
    const place = strokes.slice(0, index).filter(other => other.ring === ring).length
    const start = now + delay
    const panner = sound.pannerAt(offsetPosition(frame, strokePoint(stroke, 0.5, duration / 2)))
    const pitch = 1300 + phase * 900
    sound.hiss(start, duration + 0.12, {
      filter: {
        type: 'bandpass',
        frequency: pitch,
        end: pitch * 1.7,
        q: 0.9,
      },
      volume: 0.055,
      attack: duration * 0.45,
      hold: duration * 0.1,
    }, panner)
    // The bristles chatter over the paint’s grooves.
    sound.hiss(start + 0.02, duration + 0.04, {
      filter: {
        type: 'highpass',
        frequency: 4200,
        q: 0.5,
      },
      volume: 0.01,
      attack: duration * 0.5,
    }, panner)
    // The brush sets down into the wet paint.
    sound.hiss(start, 0.08, {
      filter: {
        type: 'lowpass',
        frequency: 900,
        end: 280,
        q: 3,
      },
      volume: 0.05,
      attack: 0.004,
    }, panner)
    const step = pentatonic[place % pentatonic.length] + 12 * Math.floor(place / pentatonic.length)
    const frequency = runStarts[Math.min(ring, runStarts.length - 1)] * 2 ** (step / 12)
    sound.tone(start + 0.01, 1.1, {
      frequency,
      type: 'triangle',
      filter: {
        type: 'lowpass',
        frequency: 2400,
        end: 900,
      },
      volume: 0.03 - index * 0.0007,
      attack: 0.004,
    })
    sound.tone(start + 0.01, 0.5, {
      frequency: frequency * 2,
      volume: 0.008,
      attack: 0.004,
    })
  }
  sound.hiss(now + strokeDrying.start, strokeDrying.stagger + strokeDrying.seconds, {
    filter: {
      type: 'bandpass',
      frequency: 2800,
      end: 1800,
      q: 0.6,
    },
    volume: 0.014,
    attack: 0.35,
    hold: 0.3,
  })
  sound.finish(2)
}
