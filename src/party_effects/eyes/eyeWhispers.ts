import type {PartySite} from '../lib/partySite.ts'
import type {StaringEye} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {staring} from './flights.ts'

/** the vowels the whispers murmur, by the centers of their two lowest formants, in hertz */
const murmurs = [[700, 1200], [400, 2200], [520, 1650], [330, 900], [600, 1900]] as const
/** the stinger as the eyes snap round: low strings a semitone and a tritone apart, in hertz */
const stinger = [110, 116.54, 155.56, 164.81]

/**
 * The sound of eyes opening in the air around the origin at `site`, from now on: a wet, sticky squelch as each opens, where it opens, whispers murmuring from all round over a beating drone that swells until the eyes snap round to stare, when a deep boom and a stab of low, dissonant strings hit, and a wet tick as each one slams shut, all in a dark, close room.
 * It cleans up after itself once it has rung out.
 */
export default function playEyeWhispers(output: AudioOutput, site: PartySite, eyes: ReadonlyArray<StaringEye>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.35,
    decay: 0.7,
    length: 2.4,
    wet: 0.4,
  })
  const {context, now} = sound
  const lasting = Math.max(...eyes.map(({close}) => close)) + 0.3
  for (const [frequency, type, volume] of [[55, 'sine', 0.022], [58.3, 'sine', 0.022], [110, 'sawtooth', 0.012]] as const) {
    sound.tone(now, lasting, {
      frequency,
      type,
      filter: {
        type: 'lowpass',
        frequency: 320,
      },
      volume,
      attack: staring,
      hold: lasting - staring - 0.6,
    })
  }
  for (const {close, open, size, spot} of eyes) {
    const panner = sound.pannerAt(offsetPosition(site, spot))
    const send = sound.keep(new GainNode(context, {gain: 1}))
    send.connect(panner)
    send.connect(sound.keep(new GainNode(context, {gain: 0.4}))).connect(sound.bus)
    const loudness = size / 0.3
    sound.hiss(now + open, 0.15, {
      filter: {
        type: 'bandpass',
        frequency: 340,
        end: 1300,
        q: 7,
      },
      volume: 0.05 * loudness,
      attack: 0.01,
    }, send)
    sound.hiss(now + open + 0.03, 0.05, {
      filter: {
        type: 'lowpass',
        frequency: 600,
      },
      volume: 0.03 * loudness,
      attack: 0.002,
    }, send)
    sound.hiss(now + close, 0.045, {
      filter: {
        type: 'bandpass',
        frequency: 1700,
        q: 3,
      },
      volume: 0.03 * loudness,
      attack: 0.002,
    }, send)
  }
  // Whispers murmur from all round, syllable by syllable, hissing now and then.
  for (const [index, [first, second]] of murmurs.entries()) {
    const eye = eyes[index * 2 % eyes.length]
    const panner = sound.pannerAt(offsetPosition(site, eye.spot))
    const voice = sound.keep(new GainNode(context, {gain: 0.5}))
    const syllables = sound.keep(new OscillatorNode(context, {
      type: 'triangle',
      frequency: 4.2 + index * 0.7,
    }))
    const depth = sound.keep(new GainNode(context, {gain: 0.5}))
    syllables.connect(depth).connect(voice.gain)
    const start = now + 0.1 + index * 0.12
    const duration = lasting - 0.3 - index * 0.12
    for (const [formant, frequency] of [first, second].entries()) {
      sound.hiss(start, duration, {
        filter: {
          type: 'bandpass',
          frequency,
          end: frequency * 0.85,
          q: 9,
        },
        volume: formant ? 0.1 : 0.16,
        attack: 0.4,
        hold: duration * 0.5,
      }, voice)
    }
    sound.hiss(start, duration, {
      filter: {
        type: 'highpass',
        frequency: 5200,
      },
      volume: 0.02,
      attack: 0.5,
      hold: duration * 0.4,
    }, voice)
    sound.envelope(voice, start, duration, {
      volume: 0.06,
      attack: 0.3,
      hold: duration * 0.6,
    }, panner)
    syllables.start(start)
    syllables.stop(start + duration + 0.02)
  }
  const snap = now + staring
  sound.tone(snap, 0.8, {
    frequency: 62,
    end: 28,
    volume: 0.14,
    attack: 0.004,
  })
  sound.hiss(snap, 0.04, {
    filter: {
      type: 'highpass',
      frequency: 2200,
    },
    volume: 0.05,
    attack: 0.001,
  })
  for (const frequency of stinger) {
    sound.tone(snap, 1.1, {
      frequency,
      type: 'sawtooth',
      vibrato: [1.5, 5.5],
      filter: {
        type: 'lowpass',
        frequency: 2200,
        end: 500,
      },
      volume: 0.02,
      attack: 0.006,
      hold: 0.08,
    })
  }
  sound.finish(3)
}
