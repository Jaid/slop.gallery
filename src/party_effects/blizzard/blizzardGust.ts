import type {PartySite} from '../lib/partySite.ts'
import type {BlizzardParticle} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {blizzardDone, blizzardOffset} from './flights.ts'

/** crystalline winter chord notes for the shattering ice chimes (F#5, A5, B5, C#6, E6, F#6, A6, B6) */
const chimeFrequencies = [739.99, 880, 987.77, 1108.73, 1318.51, 1479.98, 1760, 1975.53]

/**
 * The sound of a blizzard bursting out of `site`: a sharp flash-freeze crack, a howling arctic wind gust sweeping outward, sparkling crystalline ice chimes panned across the flying shards and a soft hush of swirling spindrift snow.
 * It cleans up after itself once it has rung out.
 */
export default function playBlizzardGust(output: AudioOutput, site: PartySite, particles: ReadonlyArray<BlizzardParticle>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.72,
    decay: 0.45,
    length: 1.5,
    wet: 0.36,
  })
  const {now} = sound
  const floor = site.floor - site.center[1]
  // Sharp flash-freeze crack and brittle ice shatter right at the burst.
  sound.hiss(now, 0.14, {
    filter: {
      type: 'highpass',
      frequency: 2600,
      end: 1100,
      q: 1.4,
    },
    volume: 0.085,
    attack: 0.002,
  })
  sound.tone(now, 0.16, {
    frequency: 1950,
    end: 420,
    volume: 0.032,
    attack: 0.002,
  })
  // Swirling arctic gale: a deep cold gust plus a whistling high spindrift wind that swells and fades over the storm.
  sound.hiss(now + 0.04, 3.2, {
    filter: {
      type: 'bandpass',
      frequency: 360,
      end: 180,
      q: 2.2,
    },
    volume: 0.068,
    attack: 0.28,
    hold: 0.65,
  })
  sound.hiss(now + 0.12, 3.6, {
    filter: {
      type: 'bandpass',
      frequency: 1250,
      end: 780,
      q: 3.4,
    },
    volume: 0.038,
    attack: 0.4,
    hold: 0.9,
  })
  // Soft diamond-dust spindrift sweeping outward as the snowflakes settle.
  sound.hiss(now + 0.35, Math.max(1.5, blizzardDone - 0.6), {
    filter: {
      type: 'highpass',
      frequency: 3400,
      end: 2200,
      q: 0.8,
    },
    volume: 0.016,
    attack: 0.45,
    hold: 0.8,
  })
  // Sparkling crystalline chimes scattered across the bursting ice shards and hero snowflakes.
  const shards = particles.filter(particle => particle.kind === 2)
  for (let index = 0; index < 14; index++) {
    const particle = shards[index * 2 % shards.length]
    const start = now + 0.04 + index * 0.16 + particle.phase % 0.08
    const frequency = chimeFrequencies[index % chimeFrequencies.length] * (1 + (index % 3 - 1) * 0.003)
    const panner = sound.pannerAt(offsetPosition(site, blizzardOffset(particle, 0.45, floor)))
    sound.tone(start, 0.85, {
      frequency,
      volume: 0.022 - index * 0.0007,
      attack: 0.004,
    }, panner)
    // Inharmonic glassy overtone for crisp ice-crystal bell sparkle.
    sound.tone(start, 0.28, {
      frequency: frequency * 2.756,
      volume: 0.008,
      attack: 0.002,
    }, panner)
    // Feed a share into the central bus so the chimes shimmer in the hall.
    sound.tone(start, 0.6, {
      frequency,
      volume: 0.008,
      attack: 0.005,
    })
  }
  sound.finish(2)
}
