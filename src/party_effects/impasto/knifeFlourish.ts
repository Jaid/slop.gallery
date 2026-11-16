import type {PartySite} from '../lib/partySite.ts'
import type {BrushStroke} from '../strokes/flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {strokeDrying, strokePoint} from '../strokes/flights.ts'

/**
 * The sound of palette knives troweling thick slabs of paint into the air around the origin at `site`, from now on: every smear a long, gritty drag of steel through loaded paint, duller and slower than a brush’s swish, heard from the middle of the smear, with a wet smack as the loaded knife sets down and a dull knock of its handle as it lifts off, all in a small, warm studio; then a dry rustle while the smears dry away.
 * It cleans up after itself once it has rung out.
 */
export default function playKnifeFlourish(output: AudioOutput, site: PartySite, strokes: ReadonlyArray<BrushStroke>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.5,
    decay: 0.45,
    length: 1.8,
    wet: 0.3,
  })
  const {now} = sound
  for (const stroke of strokes) {
    const {delay, duration, phase, ring} = stroke
    const start = now + delay
    const panner = sound.pannerAt(offsetPosition(site, strokePoint(stroke, 0.5, duration / 2)))
    const pitch = 620 + phase * 380
    // The drag itself: low, gritty, falling as the paint under the blade runs thin.
    sound.hiss(start, duration + 0.1, {
      filter: {
        type: 'bandpass',
        frequency: pitch,
        end: pitch * 0.55,
        q: 1.1,
      },
      volume: 0.07,
      attack: duration * 0.35,
      hold: duration * 0.15,
    }, panner)
    // The grit of pigment under the steel.
    sound.hiss(start + 0.02, duration + 0.04, {
      filter: {
        type: 'highpass',
        frequency: 3200,
        q: 0.5,
      },
      volume: 0.009,
      attack: duration * 0.4,
    }, panner)
    // The loaded knife sets down into the wet paint.
    sound.hiss(start, 0.09, {
      filter: {
        type: 'lowpass',
        frequency: 520,
        end: 180,
        q: 3,
      },
      volume: 0.06,
      attack: 0.004,
    }, panner)
    // Its handle knocks dully as it lifts off, the outer ring’s knives the deeper.
    sound.tone(start + duration, 0.16, {
      frequency: 190 - ring * 45,
      type: 'triangle',
      filter: {
        type: 'lowpass',
        frequency: 700,
        end: 300,
      },
      volume: 0.02,
      attack: 0.004,
    }, panner)
  }
  sound.hiss(now + strokeDrying.start, strokeDrying.stagger + strokeDrying.seconds, {
    filter: {
      type: 'bandpass',
      frequency: 1900,
      end: 1300,
      q: 0.6,
    },
    volume: 0.016,
    attack: 0.35,
    hold: 0.3,
  })
  sound.finish(2)
}
