import type {PartySite} from '../lib/partySite.ts'
import type {LashingTendril} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {snapping, tendrilReach} from './flights.ts'

/** the sinews creaking while the tendrils writhe: the pitch each strains at and where its creak rings, in hertz */
const sinews = [[68, 520], [81, 760], [97, 430]] as const
/** the vowel the groan moans, “oh”, by the centers of its two lowest formants, in hertz */
const groanFormants = [480, 820] as const

/**
 * The sound of tendrils lashing out of the origin at `site`, from now on: the wet crack of every tendril lashing out, heard toward its tip, sinews creaking and flesh squelching while they writhe under a deep, sinking groan, and a slurp as each snaps back into the origin, with a fleshy thud once the last is gone, all in a dark, close room.
 * It cleans up after itself once it has rung out.
 */
export default function playFleshGroan(output: AudioOutput, site: PartySite, tendrils: ReadonlyArray<LashingTendril>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.35,
    decay: 0.55,
    length: 2,
    wet: 0.35,
  })
  const {context, now} = sound
  const gone = Math.max(...tendrils.map(({retract}) => retract)) + snapping
  for (const tendril of tendrils) {
    const [along, up, out] = tendrilReach(tendril)
    const panner = sound.pannerAt(offsetPosition(site, [along * 0.6, up * 0.6, out * 0.6]))
    const send = sound.keep(new GainNode(context, {gain: 1}))
    send.connect(panner)
    send.connect(sound.keep(new GainNode(context, {gain: 0.4}))).connect(sound.bus)
    const start = now + tendril.delay
    sound.hiss(start, 0.22, {
      filter: {
        type: 'bandpass',
        frequency: 420,
        end: 3400,
        q: 1.5,
      },
      volume: 0.06,
      attack: 0.03,
    }, send)
    sound.hiss(start + 0.2, 0.18, {
      filter: {
        type: 'bandpass',
        frequency: 650,
        end: 280,
        q: 5,
      },
      volume: 0.045,
      attack: 0.004,
    }, send)
    const back = now + tendril.retract
    sound.hiss(back, snapping, {
      filter: {
        type: 'bandpass',
        frequency: 2800,
        end: 380,
        q: 1.3,
      },
      volume: 0.05,
      attack: snapping * 0.7,
    }, send)
    sound.hiss(back + snapping * 0.6, 0.2, {
      filter: {
        type: 'bandpass',
        frequency: 1500,
        end: 240,
        q: 8,
      },
      volume: 0.05,
      attack: 0.01,
    }, send)
  }
  // Sinews creak while they writhe, straining and slackening.
  for (const [index, [pitch, ring]] of sinews.entries()) {
    const start = now + 0.3 + index * 0.1
    const duration = gone - 0.3 - index * 0.1
    const straining = sound.keep(new GainNode(context, {gain: 0.5}))
    const strain = sound.keep(new OscillatorNode(context, {
      type: 'triangle',
      frequency: 1.9 + index * 0.6,
    }))
    const strainDepth = sound.keep(new GainNode(context, {gain: 0.5}))
    strain.connect(strainDepth).connect(straining.gain)
    sound.tone(start, duration, {
      frequency: pitch,
      detune: index * 7,
      type: 'sawtooth',
      vibrato: [pitch * 0.06, 0.7 + index * 0.3],
      filter: {
        type: 'bandpass',
        frequency: ring,
        q: 12,
      },
      volume: 0.18,
      attack: 0.25,
      hold: duration * 0.5,
    }, straining)
    straining.connect(sound.bus)
    strain.start(start)
    strain.stop(start + duration + 0.02)
  }
  // Flesh squelches now and then.
  for (let index = 0; index < 9; index++) {
    const at = 0.4 + index * 0.618 % 1 * (gone - 0.9)
    sound.hiss(now + at, 0.09, {
      filter: {
        type: 'bandpass',
        frequency: 480 + index * 0.382 % 1 * 700,
        q: 4,
      },
      volume: 0.03,
      attack: 0.006,
    })
  }
  // A deep groan, “oh”, sinking.
  const groan = sound.keep(new GainNode(context, {gain: 1}))
  for (const [index, frequency] of groanFormants.entries()) {
    const formant = sound.keep(new BiquadFilterNode(context, {
      type: 'bandpass',
      frequency,
      Q: 6,
    }))
    groan.connect(formant)
    sound.envelope(formant, now + 0.25, gone - 0.2, {
      volume: index ? 0.06 : 0.1,
      attack: 0.5,
      hold: gone - 1.2,
    })
  }
  sound.tone(now + 0.25, gone - 0.2, {
    frequency: 84,
    end: 58,
    type: 'sawtooth',
    vibrato: [2.5, 4.6],
    volume: 1,
    attack: 0.05,
    hold: gone - 0.6,
  }, groan)
  sound.tone(now + gone, 0.3, {
    frequency: 92,
    end: 38,
    volume: 0.1,
    attack: 0.004,
  })
  sound.finish(3)
}
