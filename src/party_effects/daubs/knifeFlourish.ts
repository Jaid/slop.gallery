import type {PartySite} from '../lib/partySite.ts'
import type {PaletteDaub} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {daubOffset} from './flights.ts'

/** warm lydian scale steps for tactile marimba-like strokes, in semitones */
const lydian = [0, 2, 4, 6, 7, 9, 11]
const roots = [196, 261.63, 392]

/**
 * The sound of impasto daubs flung out by unseen palette knives at `site`: thick buttery paste slaps, crisp steel knife scrapes across the air, warm wooden marimba-like plucks rising ring by ring and a final dry crackle as the crusts settle.
 */
export default function playKnifeFlourish(output: AudioOutput, site: PartySite, daubs: ReadonlyArray<PaletteDaub>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.55,
    decay: 0.5,
    length: 1.9,
    wet: 0.32,
  })
  const {now} = sound
  for (const [index, daub] of daubs.entries()) {
    const {delay, flight, phase, ring} = daub
    const place = daubs.slice(0, index).filter(other => other.ring === ring).length
    const start = now + delay
    const panner = sound.pannerAt(offsetPosition(site, daubOffset(daub, flight * 0.4)))
    // Buttery wet paint slap as the knife flings the slab.
    sound.hiss(start, 0.09, {
      filter: {
        type: 'lowpass',
        frequency: 780,
        end: 210,
        q: 2.8,
      },
      volume: 0.052,
      attack: 0.003,
    }, panner)
    // Steel palette knife scrape sweeping up in pitch.
    const scrapeFreq = 1600 + phase * 1100
    sound.hiss(start + 0.015, 0.22, {
      filter: {
        type: 'bandpass',
        frequency: scrapeFreq,
        end: scrapeFreq * 1.45,
        q: 1.8,
      },
      volume: 0.036,
      attack: 0.03,
      hold: 0.04,
    }, panner)
    // Tactile warm woody note per slab, rising outward across the three rings.
    const step = lydian[place % lydian.length] + 12 * Math.floor(place / lydian.length)
    const frequency = roots[Math.min(ring, roots.length - 1)] * 2 ** (step / 12)
    sound.tone(start + 0.01, 1.35, {
      frequency,
      type: 'triangle',
      filter: {
        type: 'lowpass',
        frequency: 2100,
        end: 750,
      },
      volume: 0.032 - index * 0.0006,
      attack: 0.004,
    }, panner)
    sound.tone(start + 0.01, 0.25, {
      frequency: frequency * 2.98,
      volume: 0.008,
      attack: 0.002,
    }, panner)
  }
  // Crusting and dry flake rustle as the slabs dry in midair well past 1.5 s.
  sound.hiss(now + 1.85, 0.95, {
    filter: {
      type: 'bandpass',
      frequency: 2600,
      end: 1700,
      q: 0.9,
    },
    volume: 0.024,
    attack: 0.25,
    hold: 0.25,
  })
  sound.finish(2.2)
}
