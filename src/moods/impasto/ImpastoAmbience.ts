import type {NoiseBed, Range} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** the hush of the studio the knife works in and, faint behind it, a town through an open window, both wandering a little. A single band-pass falls off only 6 dB per octave and lets the white noise through as hiss, so each one is cascaded. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 200,
    q: 0.8,
    stages: 3,
    volume: 0.05,
    sway: [0.1, 0.5],
    drift: [0.05, 350],
  },
  {
    filter: 'bandpass',
    frequency: 550,
    q: 1.1,
    stages: 2,
    volume: 0.007,
    sway: [0.2, 0.8],
    drift: [0.04, 500],
  },
]
/** the knife troweled through thick paint now and then, a few long drags in a row, each gritty and slow, dying off where the paint runs out under the blade */
const drags = {
  rate: 1 / 9,
  count: [1, 3] as Range,
  /** seconds from one drag to the next */
  spacing: [0.9, 1.6] as Range,
  frequency: [480, 900] as Range,
  duration: [0.7, 1.4] as Range,
  volume: [0.014, 0.024] as Range,
}
/** the knife scraped clean on the palette’s edge, rarely */
const scrapes = {
  rate: 1 / 18,
  frequency: [3200, 5200] as Range,
  duration: [0.22, 0.45] as Range,
  volume: [0.003, 0.006] as Range,
}
/** a load of paint squeezed and plopped onto the palette: a soft, wet fall of pitch */
const dollops = {
  rate: 1 / 13,
  frequency: [260, 340] as Range,
  volume: [0.006, 0.011] as Range,
}
/** the knife tapped against the jar to shake the paint off, a few times */
const taps = {
  rate: 1 / 26,
  count: [2, 3] as Range,
  spacing: 0.13,
  frequency: [2100, 2600] as Range,
  volume: 0.0035,
}

/** The Impasto Orb’s thick paint at work: a palette knife dragging loaded paint across the canvas in long, gritty passes, scraped clean on the palette now and then, a fresh dollop squeezed out, and, rarest, the knife tapped against its jar. */
export default class ImpastoAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-impasto',
      title: 'Impasto',
      gain: 0.5,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(drags.rate, from, until)) {
      const count = Math.round(this.vary(drags.count))
      const frequency = this.vary(drags.frequency)
      let at = time
      for (let i = 0; i < count; i++) {
        const duration = this.vary(drags.duration)
        // There and back, the drag away from the painter a little brighter than the one back.
        this.burst(at, duration, this.vary(drags.volume), frequency * (i % 2 ? 0.8 : 1), 1.1, duration * 0.35)
        at += this.vary(drags.spacing)
      }
    }
    for (const time of this.scatter(scrapes.rate, from, until)) {
      const duration = this.vary(scrapes.duration)
      this.burst(time, duration, this.vary(scrapes.volume), this.vary(scrapes.frequency), 3, duration * 0.25)
    }
    for (const time of this.scatter(dollops.rate, from, until)) {
      const frequency = this.vary(dollops.frequency)
      this.chirp(time, 0.18, this.vary(dollops.volume), frequency, frequency * 0.32)
    }
    for (const time of this.scatter(taps.rate, from, until)) {
      const count = Math.round(this.vary(taps.count))
      const frequency = this.vary(taps.frequency)
      for (let i = 0; i < count; i++) {
        // Glass rings with a quieter, inharmonic partial that dies away first.
        this.chirp(time + i * taps.spacing, 0.25, taps.volume, frequency)
        this.chirp(time + i * taps.spacing, 0.1, taps.volume * 0.3, frequency * 2.71)
      }
    }
  }
}
