import type {NoiseBed, Range, ToneBed} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** a blizzard howling round the walls: a deep roar of wind, a narrow band of it wandering high up and down like a draft whistling through a gap, and the hiss of snow blown along. A single band-pass falls off only 6 dB per octave and lets the white noise through as hiss, so each one is cascaded. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'lowpass',
    frequency: 260,
    q: 0.8,
    stages: 2,
    volume: 0.11,
    sway: [0.12, 0.7],
    drift: [0.05, 500],
  },
  {
    filter: 'bandpass',
    frequency: 620,
    q: 6,
    stages: 2,
    volume: 0.05,
    sway: [0.09, 0.95],
    drift: [0.11, 1400],
  },
  {
    filter: 'bandpass',
    frequency: 980,
    q: 9,
    stages: 2,
    volume: 0.025,
    sway: [0.07, 0.95],
    drift: [0.08, 1200],
  },
  {
    filter: 'highpass',
    frequency: 4200,
    q: 0.7,
    stages: 2,
    volume: 0.008,
    sway: [0.3, 0.8],
  },
]
/** a hollow, cold drone under the storm, a fifth beating so slowly that it only shivers */
const tones: ReadonlyArray<ToneBed> = [
  {
    frequency: 110,
    beat: 0.15,
    volume: 0.008,
    sway: [0.05, 0.6],
  },
  {
    frequency: 164.8,
    beat: 0.23,
    volume: 0.004,
    sway: [0.07, 0.7],
  },
]
/** gusts that sweep in, swell and die away, as noise blown in softly */
const gusts = {
  rate: 1 / 6,
  frequency: [300, 700] as Range,
  duration: [1.6, 3.2] as Range,
  volume: [0.03, 0.06] as Range,
}
/** ice crystals tinkling against each other in the wind, a few high, glassy notes close together, from a scale of fifths, so they ring like wind chimes of ice rather than at random */
const tinkles = {
  rate: 1 / 5,
  notes: [1760, 2637, 3136, 3520, 3951, 5274],
  count: [2, 5] as Range,
  spacing: [0.05, 0.16] as Range,
  volume: [0.0025, 0.005] as Range,
}
/** the ice of a frozen lake far off groaning and cracking under the cold: a low glide down and the snap of a crack */
const ice = {
  rate: 1 / 24,
  frequency: [700, 1300] as Range,
  /** factor the pitch falls by, like the eerie, laser-like song of lake ice */
  fall: [0.15, 0.3] as Range,
  duration: [0.6, 1.2] as Range,
  volume: [0.004, 0.008] as Range,
}

/** The Frost Orb’s blizzard: wind howling and whistling round the walls in gusts, snow hissing along, ice crystals tinkling in it and, far off, the ice of a frozen lake singing as it cracks. */
export default class FrostAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-frost',
      title: 'Blizzard',
      gain: 0.35,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override get tones() {
    return tones
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(gusts.rate, from, until)) {
      const duration = this.vary(gusts.duration)
      this.burst(time, duration, this.vary(gusts.volume), this.vary(gusts.frequency), 0.7, duration * 0.45)
    }
    for (const time of this.scatter(tinkles.rate, from, until)) {
      const count = Math.round(this.vary(tinkles.count))
      let at = time
      for (let i = 0; i < count; i++) {
        const note = tinkles.notes[Math.floor(Math.random() * tinkles.notes.length)]
        const volume = this.vary(tinkles.volume)
        // A sliver of ice rings with a quieter, inharmonic partial that dies away first.
        this.chirp(at, 0.9, volume, note)
        this.chirp(at, 0.25, volume * 0.3, note * 2.43)
        at += this.vary(tinkles.spacing)
      }
    }
    for (const time of this.scatter(ice.rate, from, until)) {
      const frequency = this.vary(ice.frequency)
      const duration = this.vary(ice.duration)
      this.burst(time, 0.05, this.vary(ice.volume) * 2, 2200, 1.5)
      this.swell(time + 0.02, duration, this.vary(ice.volume), frequency, {
        attack: 0.01,
        endFrequency: frequency * this.vary(ice.fall),
      })
    }
  }
}
