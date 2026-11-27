import type {PartySite} from '../lib/partySite.ts'
import type {BlownFlake} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {flakeOffset, largeCrystal} from './flights.ts'

/** the notes the ice crystals ring at, one octave of a pentatonic scale on E, high up like wind chimes of ice, in hertz */
const chimes = [2637, 2960, 3520, 3951, 4699]

/** The note the `index`th large crystal rings at as it sails out: down the scale from its highest note, on into the octaves below, so every crystal rings lower than the one before. */
export function crystalChime(index: number) {
  return chimes[chimes.length - 1 - index % chimes.length] / 2 ** Math.floor(index / chimes.length)
}

/**
 * The sound of a blizzard bursting out of the origin at `site`, from now on: a deep thump of air and the howl of a gust rushing out, rising and falling in pitch as it whirls, with the hiss of driven snow over it, and the large crystals ringing like chimes of ice as they sail out, each from where it is at that moment, descending as they scatter, then a few crackles of frost, all in a cold, hard hall with a long echo.
 * It cleans up after itself once it has rung out.
 */
export default function playBlizzardGust(output: AudioOutput, site: PartySite, flakes: ReadonlyArray<BlownFlake>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.8,
    decay: 0.9,
    length: 2.6,
    wet: 0.4,
  })
  const {now} = sound
  // The storm drifts out into the room as it blows.
  sound.glide(offsetPosition(site, [0, 0.4, 1.2]), now + 2)
  sound.hiss(now, 0.35, {
    filter: {
      type: 'lowpass',
      frequency: 220,
      end: 90,
      q: 1.2,
    },
    volume: 0.2,
    attack: 0.01,
  })
  // The gust: a narrow band of wind whose pitch climbs as it bursts out and sinks as it whirls away, over a broad rush.
  sound.hiss(now + 0.02, 2.2, {
    filter: {
      type: 'bandpass',
      frequency: 380,
      end: 260,
      q: 0.8,
    },
    volume: 0.16,
    attack: 0.18,
    hold: 0.5,
  })
  for (const [start, from, to, volume] of [[0.04, 520, 1250, 0.07], [0.5, 1250, 640, 0.06], [1.1, 900, 420, 0.04]] as const) {
    sound.hiss(now + start, 1, {
      filter: {
        type: 'bandpass',
        frequency: from,
        end: to,
        q: 7,
      },
      volume,
      attack: 0.3,
    })
  }
  sound.hiss(now + 0.05, 1.8, {
    filter: {
      type: 'highpass',
      frequency: 3800,
      end: 6000,
      q: 0.6,
    },
    volume: 0.035,
    attack: 0.2,
    hold: 0.4,
  })
  // Each large crystal rings once as it sails out, from where it is then, lower the later it goes.
  const crystals = flakes.filter(({size}) => size >= largeCrystal)
  for (const [index, crystal] of crystals.entries()) {
    const at = crystal.delay + 0.12
    const panner = sound.pannerAt(offsetPosition(site, flakeOffset(crystal, 0.12)))
    const note = crystalChime(index)
    sound.tone(now + at, 1.4, {
      frequency: note,
      volume: 0.022,
      attack: 0.003,
    }, panner)
    // A sliver of ice rings with a quieter, inharmonic partial that dies away first.
    sound.tone(now + at, 0.35, {
      frequency: note * 2.43,
      volume: 0.007,
      attack: 0.002,
    }, panner)
  }
  // Frost crackling as the snow settles.
  for (let crackle = 0; crackle < 9; crackle++) {
    sound.hiss(now + 1 + crackle * 0.17 + Math.random() * 0.1, 0.03, {
      filter: {
        type: 'bandpass',
        frequency: 2500 + Math.random() * 3000,
        q: 2,
      },
      volume: 0.02 + Math.random() * 0.02,
      attack: 0.002,
    })
  }
  sound.finish(3)
}
