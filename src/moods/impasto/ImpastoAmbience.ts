import type {NoiseBed, Range} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** the hush of a painter’s loft at dusk and, faint behind it, the sea under its window, swelling and drawing back. A single band-pass falls off only 6 dB per octave and lets the white noise through as hiss, so each one is cascaded. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 200,
    q: 0.8,
    stages: 3,
    volume: 0.05,
    sway: [0.08, 0.6],
    drift: [0.04, 500],
  },
  {
    filter: 'lowpass',
    frequency: 520,
    q: 0.7,
    stages: 2,
    volume: 0.012,
    sway: [0.12, 0.9],
  },
]
/** a palette knife working a lump of heavy paint now and then: it slaps a few times on the board, each slap a wet thud with a brief scrape as the blade drags on */
const knifework = {
  rate: 1 / 8,
  count: [2, 4] as Range,
  /** seconds from one slap to the next */
  spacing: [0.38, 0.6] as Range,
  frequency: [320, 520] as Range,
  scrape: [2400, 3600] as Range,
  volume: [0.01, 0.018] as Range,
}
/** the knife scraped clean on the rim of the palette, rarely */
const cleanings = {
  rate: 1 / 26,
  frequency: [5200, 6800] as Range,
  duration: [0.25, 0.45] as Range,
  volume: [0.0025, 0.0045] as Range,
}
/** a gull far off over the sea, crying twice or three times */
const gull = {
  rate: 1 / 30,
  cries: [2, 3] as Range,
  spacing: 0.34,
  frequency: [1500, 1800] as Range,
  volume: 0.0025,
}

/** The Impasto Orb’s knifework: the hush of a loft by the sea at dusk, its waves swelling and drawing back under the window, a palette knife slapping and dragging heavy paint now and then, scraped clean on the palette’s rim, and, rarer, a gull far off. */
export default class ImpastoAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-impasto',
      title: 'Knifework',
      gain: 0.5,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(knifework.rate, from, until)) {
      const count = Math.round(this.vary(knifework.count))
      let at = time
      for (let i = 0; i < count; i++) {
        const volume = this.vary(knifework.volume)
        // The slap of the blade into heavy paint, low and wet, then a short scrape as it drags on.
        this.burst(at, 0.09, volume, this.vary(knifework.frequency), 1.4, 0.004)
        this.burst(at + 0.05, 0.22, volume * 0.35, this.vary(knifework.scrape), 2.5, 0.06)
        at += this.vary(knifework.spacing)
      }
    }
    for (const time of this.scatter(cleanings.rate, from, until)) {
      const duration = this.vary(cleanings.duration)
      this.burst(time, duration, this.vary(cleanings.volume), this.vary(cleanings.frequency), 3.5, duration * 0.25)
    }
    for (const time of this.scatter(gull.rate, from, until)) {
      const cries = Math.round(this.vary(gull.cries))
      const frequency = this.vary(gull.frequency)
      for (let i = 0; i < cries; i++) {
        // Each cry rises, then falls away.
        this.swell(time + i * gull.spacing, 0.26, gull.volume, frequency, {
          attack: 0.05,
          endFrequency: frequency * 0.7,
          type: 'triangle',
          vibrato: [11, 30],
        })
      }
    }
  }
}
