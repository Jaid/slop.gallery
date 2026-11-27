import type {NoiseBed, Range} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** arctic wind, deep and howling, each band wandering and gusting on its own. A single band-pass falls off only 6 dB per octave and lets the white noise through as hiss, so each one is cascaded. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'lowpass',
    frequency: 110,
    stages: 2,
    volume: 0.05,
    sway: [0.1, 0.5],
  },
  {
    filter: 'bandpass',
    frequency: 420,
    q: 1.1,
    stages: 3,
    volume: 0.07,
    sway: [0.13, 0.75],
    drift: [0.06, 700],
  },
  {
    filter: 'bandpass',
    frequency: 1250,
    q: 2.2,
    stages: 2,
    volume: 0.012,
    sway: [0.09, 0.9],
    drift: [0.05, 900],
  },
]
/** ice cracking somewhere near: a few sharp ticks running away as the fracture spreads, each a little lower than the last, over a dull thock */
const cracks = {
  rate: 1 / 9,
  count: [2, 4] as Range,
  spacing: [0.03, 0.08] as Range,
  frequency: [2600, 5200] as Range,
  volume: [0.004, 0.009] as Range,
}
/** an icicle tinkling as it settles or a shard drops, rarely: a bright ping with its inharmonic partial dying first */
const tinkles = {
  rate: 1 / 16,
  frequency: [3800, 6400] as Range,
  volume: 0.0025,
}
/** thick ice groaning under its own weight, rarest: a long low swell sinking as it goes */
const groans = {
  rate: 1 / 28,
  frequency: [85, 140] as Range,
  duration: [2.5, 4.5] as Range,
  volume: [0.006, 0.01] as Range,
}

/** The Frost Orb’s blizzard: arctic wind gusting and howling round the listener, ice cracking now and then, an icicle tinkling and, rarest, thick ice groaning in the deep cold. */
export default class FrostAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-frost',
      title: 'Blizzard',
      gain: 0.42,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(cracks.rate, from, until)) {
      const count = Math.round(this.vary(cracks.count))
      const frequency = this.vary(cracks.frequency)
      const volume = this.vary(cracks.volume)
      this.burst(time, 0.09, volume * 0.7, 300, 1.2, 0.004)
      let at = time
      for (let i = 0; i < count; i++) {
        this.burst(at, 0.045, volume * (1 - i * 0.18), frequency * (1 - i * 0.14), 5, 0.002)
        at += this.vary(cracks.spacing)
      }
    }
    for (const time of this.scatter(tinkles.rate, from, until)) {
      const frequency = this.vary(tinkles.frequency)
      this.chirp(time, 0.5, tinkles.volume, frequency)
      this.chirp(time, 0.16, tinkles.volume * 0.3, frequency * 2.76)
    }
    for (const time of this.scatter(groans.rate, from, until)) {
      const frequency = this.vary(groans.frequency)
      const duration = this.vary(groans.duration)
      this.swell(time, duration, this.vary(groans.volume), frequency, {
        attack: duration * 0.4,
        endFrequency: frequency * 0.7,
        vibrato: [2, 2.5],
      })
    }
  }
}
