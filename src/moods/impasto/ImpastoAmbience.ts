import type {NoiseBed, Range} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** the warm hush of a quiet workshop and the deeper resonance of stretched canvas, cascaded so no white hiss escapes */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 190,
    q: 0.85,
    stages: 3,
    volume: 0.052,
    sway: [0.12, 0.45],
    drift: [0.05, 320],
  },
  {
    filter: 'bandpass',
    frequency: 420,
    q: 1.1,
    stages: 2,
    volume: 0.01,
    sway: [0.18, 0.7],
    drift: [0.04, 500],
  },
]
/** a palette knife troweling thick paste across linen, pressing in at the start and lifting off */
const trowels = {
  rate: 1 / 6,
  count: [1, 3] as Range,
  spacing: [0.42, 0.7] as Range,
  frequency: [1100, 2100] as Range,
  duration: [0.24, 0.5] as Range,
  volume: [0.009, 0.016] as Range,
}
/** stiff hog bristles stippling heavy paint onto the weave in brisk dabs */
const dabs = {
  rate: 1 / 9,
  count: [3, 6] as Range,
  spacing: [0.09, 0.16] as Range,
  frequency: [1600, 2800] as Range,
  duration: [0.05, 0.09] as Range,
  volume: [0.005, 0.01] as Range,
}
/** a steel knife blade flexing cleanly against the palette’s rim */
const flexes = {
  rate: 1 / 18,
  frequency: [2900, 3900] as Range,
  volume: 0.0035,
}

/** The Impasto Orb’s relief: a warm studio hush, a palette knife pressing and troweling thick paste across taut linen, stiff hog-bristle stippling and the occasional springy flex of a steel blade. */
export default class ImpastoAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-impasto',
      title: 'Impasto',
      gain: 0.55,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(trowels.rate, from, until)) {
      const count = Math.round(this.vary(trowels.count))
      const frequency = this.vary(trowels.frequency)
      let at = time
      for (let i = 0; i < count; i++) {
        const duration = this.vary(trowels.duration)
        // A soft drum-like press into the canvas followed by the thick paste scraping under the trowel.
        this.burst(at, 0.08, 0.005, 220, 1.4, 0.015)
        this.burst(at + 0.01, duration, this.vary(trowels.volume), frequency * (i % 2 ? 0.88 : 1.05), 1.8, duration * 0.32)
        at += this.vary(trowels.spacing)
      }
    }
    for (const time of this.scatter(dabs.rate, from, until)) {
      const count = Math.round(this.vary(dabs.count))
      const frequency = this.vary(dabs.frequency)
      let at = time
      for (let i = 0; i < count; i++) {
        const duration = this.vary(dabs.duration)
        this.burst(at, duration, this.vary(dabs.volume), frequency * (0.9 + i % 3 * 0.08), 1.2, duration * 0.25)
        at += this.vary(dabs.spacing)
      }
    }
    for (const time of this.scatter(flexes.rate, from, until)) {
      const frequency = this.vary(flexes.frequency)
      this.chirp(time, 0.24, flexes.volume, frequency)
      this.chirp(time, 0.1, flexes.volume * 0.3, frequency * 2.38)
    }
  }
}
