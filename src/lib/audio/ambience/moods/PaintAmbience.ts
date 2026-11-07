import type {NoiseBed} from '../base/AmbienceLoop.ts'
import type {Range} from '../base/noise.ts'

import AmbienceLoop from '../base/AmbienceLoop.ts'

/** the hush of a quiet studio and, faint behind it, a town through an open window, both wandering a little. A single band-pass falls off only 6 dB per octave and lets the white noise through as hiss, so each one is cascaded. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 240,
    q: 0.8,
    stages: 3,
    volume: 0.05,
    sway: [0.1, 0.5],
    drift: [0.05, 400],
  },
  {
    filter: 'bandpass',
    frequency: 650,
    q: 1.1,
    stages: 2,
    volume: 0.008,
    sway: [0.2, 0.8],
    drift: [0.04, 600],
  },
]
/** a brush working paint into the canvas now and then, a few strokes back and forth, each blown in softly and scrubbed off */
const strokes = {
  rate: 1 / 7,
  count: [2, 5] as Range,
  /** seconds from one stroke to the next */
  spacing: [0.32, 0.55] as Range,
  frequency: [1800, 3200] as Range,
  duration: [0.18, 0.42] as Range,
  volume: [0.008, 0.016] as Range,
}
/** a palette knife scraping paint off the palette, rarely */
const scrapes = {
  rate: 1 / 20,
  frequency: [4200, 6000] as Range,
  duration: [0.3, 0.6] as Range,
  volume: [0.003, 0.006] as Range,
}
/** a brush rinsed in a jar of turpentine, tapping its glass a few times */
const rinses = {
  rate: 1 / 24,
  taps: [2, 4] as Range,
  spacing: 0.11,
  frequency: [2400, 3100] as Range,
  volume: 0.004,
}

/** The Paint Orb’s atelier: the hush of a quiet studio with a town outside its window, a brush working the canvas now and then, a palette knife scraping and, rarer, a brush tapped against the glass of its jar. */
export default class PaintAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-paint',
      title: 'Atelier',
      gain: 0.5,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(strokes.rate, from, until)) {
      const count = Math.round(this.vary(strokes.count))
      const frequency = this.vary(strokes.frequency)
      let at = time
      for (let i = 0; i < count; i++) {
        const duration = this.vary(strokes.duration)
        // Back and forth, the stroke away from the painter a little brighter than the one back.
        this.burst(at, duration, this.vary(strokes.volume), frequency * (i % 2 ? 0.85 : 1), 0.9, duration * 0.4)
        at += this.vary(strokes.spacing)
      }
    }
    for (const time of this.scatter(scrapes.rate, from, until)) {
      const duration = this.vary(scrapes.duration)
      this.burst(time, duration, this.vary(scrapes.volume), this.vary(scrapes.frequency), 3, duration * 0.3)
    }
    for (const time of this.scatter(rinses.rate, from, until)) {
      const taps = Math.round(this.vary(rinses.taps))
      const frequency = this.vary(rinses.frequency)
      for (let i = 0; i < taps; i++) {
        // Glass rings with a quieter, inharmonic partial that dies away first.
        this.chirp(time + i * rinses.spacing, 0.3, rinses.volume, frequency)
        this.chirp(time + i * rinses.spacing, 0.12, rinses.volume * 0.3, frequency * 2.71)
      }
    }
  }
}
