import type {NoiseBed, Range} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** cold air pressing through iron bars: slow, deep gusts, a moan wandering in pitch that only stands out at their height and a hiss over the stone’s edges */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'lowpass',
    frequency: 260,
    stages: 2,
    volume: 0.07,
    sway: [0.12, 0.85],
  },
  {
    filter: 'bandpass',
    frequency: 520,
    q: 1.4,
    stages: 2,
    volume: 0.02,
    sway: [0.2, 0.92],
    drift: [0.15, 600],
  },
  {
    filter: 'highpass',
    frequency: 3500,
    stages: 2,
    volume: 0.002,
    sway: [0.3, 0.9],
  },
]
/** water dripping somewhere down the passage, its echo running after it */
const drips = {
  rate: 0.2,
  frequency: [1100, 2200] as Range,
  /** factor the pitch rises by as a drop falls in */
  rise: [1.4, 1.8] as Range,
  duration: [0.025, 0.05] as Range,
  volume: [0.02, 0.045] as Range,
  /** seconds after the drip and level of each echo */
  echoes: [[0.11, 0.35], [0.23, 0.14], [0.36, 0.05]] as ReadonlyArray<readonly [delay: number, level: number]>,
}
/** now and then the wind finds a bar and whistles low for a few seconds */
const whistles = {
  rate: 0.04,
  frequency: [560, 860] as Range,
  duration: [2.5, 4.5] as Range,
  volume: 0.006,
}

/** The Bastion’s drafts: cold air pressing through the iron bars of its gate and windows, water dripping somewhere down the passages with its echo running after it and now and then a low whistle where the wind finds a bar. */
export default class BastionAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-bastion',
      title: 'Drafts',
      gain: 0.22,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(drips.rate, from, until)) {
      const frequency = this.vary(drips.frequency)
      const rise = this.vary(drips.rise)
      const duration = this.vary(drips.duration)
      const volume = this.vary(drips.volume)
      this.chirp(time, duration, volume, frequency, frequency * rise)
      for (const [delay, level] of drips.echoes) {
        this.chirp(time + delay, duration * 1.4, volume * level, frequency * 0.98, frequency * rise * 0.98)
      }
    }
    for (const time of this.scatter(whistles.rate, from, until)) {
      const frequency = this.vary(whistles.frequency)
      this.swell(time, this.vary(whistles.duration), whistles.volume, frequency, {
        attack: 1.2,
        endFrequency: frequency * this.vary([0.85, 1.12]),
        vibrato: [4.5, 5],
      })
    }
  }
}
