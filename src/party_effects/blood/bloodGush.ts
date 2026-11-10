import type {PartySite} from '../lib/partySite.ts'
import type {BloodPouring, BloodSplat, Heartbeat} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'

/** the shrieking strings: a cluster of high violins a semitone apart, in hertz */
const shriek = [1244.51, 1318.51, 1396.91, 1479.98]
/** where along the wall the splats are heard from, in meters, for the drops landing nearest to each */
const splatSpots = [-1, 0, 1]

/**
 * The sound of blood spurting out of the origin at `site`, from now on: a heartbeat’s thud and a wet gush on each of the `beats`, as strong as it, a stab of shrieking violins on the first two and once more after them, sinking into a cello’s groan, a pattering splash where the `pouring` stream strikes its pool, swelling as each beat’s surge strikes it, and a wet splat for every drop of `splats` where it lands on the floor, the bigger the louder, all in a dark, close room.
 * It cleans up after itself once it has rung out.
 */
export default function playBloodGush(output: AudioOutput, site: PartySite, {beats, pouring, splats}: {
  beats: ReadonlyArray<Heartbeat>
  pouring: BloodPouring
  splats: ReadonlyArray<BloodSplat>
}) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.35,
    decay: 0.6,
    length: 2.2,
    wet: 0.38,
  })
  const {now} = sound
  for (const {at, strength} of beats) {
    sound.tone(now + at, 0.32, {
      frequency: 78,
      end: 36,
      volume: 0.13 * strength,
      attack: 0.004,
    })
    sound.hiss(now + at, 0.55, {
      filter: {
        type: 'lowpass',
        frequency: 1400,
        end: 260,
        q: 2.5,
      },
      volume: 0.1 * strength,
      attack: 0.01,
    })
    sound.hiss(now + at + 0.02, 0.4, {
      filter: {
        type: 'bandpass',
        frequency: 700,
        end: 240,
        q: 6,
      },
      volume: 0.07 * strength,
      attack: 0.015,
    })
  }
  const stabs = [beats[0].at, beats[1].at, beats[1].at * 2 - beats[0].at]
  for (const [index, at] of stabs.entries()) {
    const last = index === 2
    for (const frequency of shriek) {
      sound.tone(now + at, last ? 1.1 : 0.34, {
        frequency,
        end: last ? frequency * 0.94 : undefined,
        type: 'sawtooth',
        vibrato: [14, 6.5],
        filter: {
          type: 'bandpass',
          frequency: 2600,
          q: 0.8,
        },
        volume: 0.014,
        attack: 0.008,
        hold: last ? 0.2 : 0.05,
      })
    }
  }
  sound.tone(now + stabs[2] + 0.1, 1.6, {
    frequency: 116.54,
    end: 61.74,
    type: 'sawtooth',
    vibrato: [2, 5],
    filter: {
      type: 'lowpass',
      frequency: 700,
      q: 1.5,
    },
    volume: 0.035,
    attack: 0.15,
  })
  const pool = sound.pannerAt(offsetPosition(site, pouring.spot))
  sound.hiss(now + pouring.from, pouring.to - pouring.from + 0.25, {
    filter: {
      type: 'bandpass',
      frequency: 1100,
      end: 650,
      q: 0.9,
    },
    volume: 0.022,
    attack: 0.03,
    hold: pouring.to - pouring.from - 0.15,
  }, pool)
  for (const {at, strength} of pouring.surges) {
    sound.hiss(now + at, 0.32, {
      filter: {
        type: 'lowpass',
        frequency: 1200,
        end: 320,
        q: 1.4,
      },
      volume: 0.05 * strength,
      attack: 0.02,
    }, pool)
  }
  const floor = site.floor - site.center[1]
  const panners = splatSpots.map(along => sound.pannerAt(offsetPosition(site, [along, floor, 1.4])))
  for (const {along, at, size, speed} of splats) {
    if (size < 0.014) {
      continue
    }
    const panner = panners[along < -0.5 ? 0 : (along > 0.5 ? 2 : 1)]
    const loudness = Math.min(1, size / 0.04) * Math.min(1, 0.4 + speed / 8)
    sound.hiss(now + at, 0.06 + size, {
      filter: {
        type: 'bandpass',
        frequency: 1900 - size * 18_000,
        q: 1.6,
      },
      volume: 0.045 * loudness,
      attack: 0.002,
    }, panner)
  }
  sound.finish(3)
}
