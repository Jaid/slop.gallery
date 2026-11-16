import type {PartySite} from '../lib/partySite.ts'
import type {KnifeSmear} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {smearCrumbling, smearPoint} from './flights.ts'

/** the steps of the minor pentatonic scale the marimba strikes, in semitones */
const pentatonic = [0, 3, 5, 7, 10]
/** the note every ring of smears starts its run on, in hertz: D3, A3 and D4, a ring at a time higher */
const runStarts = [146.83, 220, 293.66]
/** how many flakes crackle off each smear as it crumbles away */
const crackles = 5
/** a pseudo-random number from 0 to 1 for the number, the same on every run */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 91.7 + 47.3) * 43_758.5453
  return value - Math.floor(value)
}

/**
 * The sound of a burst of knife smears slapped round the origin at `site`, from now on: every smear a wet slap of heavy paint as the knife sets down, heard from where it does, the blade scraping over it as it drags it out and a soft plop as it lifts off, a marimba bar struck with each, every ring of smears a run up the minor pentatonic scale, the outer ones higher, all in a small, warm studio; then a dry crackle as each one cracks and its flakes drop away.
 * It cleans up after itself once it has rung out.
 */
export default function playKnifeSlaps(output: AudioOutput, site: PartySite, smears: ReadonlyArray<KnifeSmear>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.45,
    decay: 0.4,
    length: 1.6,
    wet: 0.28,
  })
  const {now} = sound
  for (const [index, smear] of smears.entries()) {
    const {crumble, delay, duration, phase, ring} = smear
    // where in its ring’s run the smear strikes
    const place = smears.slice(0, index).filter(other => other.ring === ring).length
    const start = now + delay
    const panner = sound.pannerAt(offsetPosition(site, smearPoint(smear, 0.4, duration / 2)))
    // The heavy paint slaps down.
    sound.hiss(start, 0.09, {
      filter: {
        type: 'lowpass',
        frequency: 1100,
        end: 240,
        q: 2.4,
      },
      volume: 0.07,
      attack: 0.002,
    }, panner)
    // The blade scrapes over it, dragging it out, and lifts off with a soft plop.
    const pitch = 2100 + phase * 900
    sound.hiss(start + 0.01, duration + 0.05, {
      filter: {
        type: 'bandpass',
        frequency: pitch,
        end: pitch * 0.6,
        q: 1.6,
      },
      volume: 0.028,
      attack: duration * 0.3,
    }, panner)
    sound.hiss(start + duration, 0.06, {
      filter: {
        type: 'lowpass',
        frequency: 600,
        end: 180,
        q: 4,
      },
      volume: 0.03,
      attack: 0.004,
    }, panner)
    // A marimba bar: its fundamental rings on, its fourth partial dies away first.
    const step = pentatonic[place % pentatonic.length] + 12 * Math.floor(place / pentatonic.length)
    const frequency = runStarts[Math.min(ring, runStarts.length - 1)] * 2 ** (step / 12)
    sound.tone(start + 0.005, 0.7, {
      frequency,
      volume: 0.034 - index * 0.0006,
      attack: 0.003,
    })
    sound.tone(start + 0.005, 0.14, {
      frequency: frequency * 3.93,
      volume: 0.01,
      attack: 0.002,
    })
    // Set, it cracks and drops its flakes, a dry tick for each.
    for (let flake = 0; flake < crackles; flake++) {
      const at = now + crumble + smearCrumbling.seconds * (0.15 + 0.8 * scatter(index * crackles + flake))
      sound.hiss(at, 0.02, {
        filter: {
          type: 'highpass',
          frequency: 3800 + scatter(index * 7 + flake) * 2400,
          q: 0.7,
        },
        volume: 0.012,
        attack: 0.001,
      }, panner)
    }
  }
  // the patter of all the flakes falling while the smears crumble
  sound.hiss(now + smearCrumbling.start, smearCrumbling.stagger + smearCrumbling.seconds, {
    filter: {
      type: 'bandpass',
      frequency: 3200,
      end: 2200,
      q: 0.8,
    },
    volume: 0.01,
    attack: 0.3,
    hold: 0.3,
  })
  sound.finish(2)
}
