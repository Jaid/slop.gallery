import type {NoiseBed, Range, ToneBed} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** wind moving through a house, two bands that wander in pitch and swell and drop out on their own. A single band-pass falls off only 6 dB per octave and lets the white noise through as hiss, so each one is cascaded. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 380,
    q: 1.2,
    stages: 3,
    volume: 0.09,
    sway: [0.15, 0.8],
    drift: [0.07, 700],
  },
  {
    filter: 'bandpass',
    frequency: 800,
    q: 1.5,
    stages: 3,
    volume: 0.03,
    sway: [0.1, 0.9],
    drift: [0.05, 900],
  },
]
/** a hollow fifth, beating so slowly that it only breathes, as if the house hummed to itself */
const tones: ReadonlyArray<ToneBed> = [
  {
    frequency: 98,
    beat: 0.2,
    volume: 0.018,
    sway: [0.06, 0.5],
  },
  {
    frequency: 147,
    beat: 0.3,
    volume: 0.006,
    sway: [0.08, 0.7],
  },
]
/** ghosts moaning somewhere in the walls now and then: long, slowly wavering glides */
const moans = {
  rate: 1 / 16,
  frequency: [260, 440] as Range,
  /** factor the pitch glides by */
  glide: [0.8, 1.2] as Range,
  duration: [3.5, 6] as Range,
  volume: [0.008, 0.016] as Range,
  vibratoRate: [2, 3.5] as Range,
  vibratoDepth: [3, 6] as Range,
}
/** a few soft, breathy sibilants close together, like someone whispering out of reach */
const whispers = {
  rate: 1 / 14,
  count: [2, 4] as Range,
  /** seconds one whisper spreads its sibilants over */
  spread: 1.2,
  frequency: [1500, 2800] as Range,
  duration: [0.15, 0.4] as Range,
  volume: [0.002, 0.005] as Range,
}

/** The Spook Orb’s haunting: wind wandering through a house that hums to itself, a ghost moaning in its walls now and then and, rarer still, a whisper. */
export default class SpookAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-spook',
      title: 'Haunting',
      gain: 0.3,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override get tones() {
    return tones
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(moans.rate, from, until)) {
      const frequency = this.vary(moans.frequency)
      const duration = this.vary(moans.duration)
      this.swell(time, duration, this.vary(moans.volume), frequency, {
        attack: duration * 0.5,
        endFrequency: frequency * this.vary(moans.glide),
        vibrato: [this.vary(moans.vibratoRate), this.vary(moans.vibratoDepth)],
      })
    }
    for (const time of this.scatter(whispers.rate, from, until)) {
      const count = Math.round(this.vary(whispers.count))
      for (let i = 0; i < count; i++) {
        this.burst(time + Math.random() * whispers.spread, this.vary(whispers.duration), this.vary(whispers.volume), this.vary(whispers.frequency), 2.5, 0.08)
      }
    }
  }
}
