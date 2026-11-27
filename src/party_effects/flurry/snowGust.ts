import type {PartySite} from '../lib/partySite.ts'
import type {Snowflake} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {flakeOffset} from './flights.ts'

/** the notes the great flakes chime in, a high pentatonic run in hertz, struck in the order they come out */
const chimes = [1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96]

/**
 * The sound of a flurry bursting out of the origin at `site`, from now on: a sharp crack as the cold breaks out, a gust of wind that swells, whirls up and dies away over the falling snow, and each great flake chiming faintly as it comes out, a high ice-clear ping with its inharmonic partial, heard from where its flake is then, all in a cold, bright space.
 * It cleans up after itself once it has rung out.
 */
export default function playSnowGust(output: AudioOutput, site: PartySite, flakes: ReadonlyArray<Snowflake>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.75,
    decay: 0.5,
    length: 2.4,
    wet: 0.26,
  })
  const {now} = sound
  const flight = Math.max(...flakes.map(({delay, life}) => delay + life))
  // The gust breaks out, whirls up in pitch and settles into a long, cold sigh over the snow still falling.
  sound.hiss(now, 0.16, {
    filter: {
      type: 'bandpass',
      frequency: 3400,
      end: 900,
      q: 3,
    },
    volume: 0.09,
    attack: 0.003,
  })
  sound.hiss(now + 0.03, flight * 0.62, {
    filter: {
      type: 'bandpass',
      frequency: 480,
      end: 1900,
      q: 1.1,
    },
    volume: 0.13,
    attack: 0.22,
    hold: 0.35,
  })
  sound.hiss(now + flight * 0.4, flight * 0.55, {
    filter: {
      type: 'bandpass',
      frequency: 1500,
      end: 620,
      q: 0.9,
    },
    volume: 0.05,
    attack: 0.4,
  })
  // Fine snow hisses faintly against the floor until the last of it has landed.
  sound.hiss(now + 0.25, flight * 0.8, {
    filter: {
      type: 'highpass',
      frequency: 5200,
      q: 0.5,
    },
    volume: 0.012,
    attack: 0.5,
  })
  // Every great flake chimes as it comes out, each a step higher than the last, wrapping around the run.
  const great = flakes.filter(({size}) => size > 0.1)
  for (const [index, flake] of great.entries()) {
    const start = now + flake.delay + 0.06
    const frequency = chimes[index % chimes.length] * (index >= chimes.length ? 1.5 : 1)
    const panner = sound.pannerAt(offsetPosition(site, flakeOffset(flake, 0.3, site.floor - site.center[1])))
    sound.tone(start, 0.9, {
      frequency,
      volume: 0.02,
      attack: 0.003,
    }, panner)
    sound.tone(start, 0.3, {
      frequency: frequency * 3.98,
      volume: 0.004,
      attack: 0.003,
    }, panner)
  }
  sound.finish(2.5)
}
