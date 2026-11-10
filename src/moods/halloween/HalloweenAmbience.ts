import type {NoiseBed, Range} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** an autumn night’s breeze, wandering a little, and dry leaves rustling in it now and then. A single band-pass falls off only 6 dB per octave and lets the white noise through as hiss, so each one is cascaded. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 380,
    q: 0.9,
    stages: 3,
    volume: 0.05,
    sway: [0.15, 0.6],
    drift: [0.06, 600],
  },
  {
    filter: 'bandpass',
    frequency: 1800,
    q: 1,
    stages: 2,
    volume: 0.003,
    sway: [0.5, 0.95],
  },
]
/** a cricket now and then, each chirping a few pulses at its own pitch */
const crickets = {
  rate: 0.3,
  pulses: [2, 3] as Range,
  /** seconds from one pulse to the next */
  spacing: 0.05,
  frequency: [4000, 4600] as Range,
  volume: [0.002, 0.004] as Range,
}
/** an owl’s three hoots, the last one longest, each as long as given and starting after the given seconds */
const owl = {
  rate: 1 / 22,
  hoots: [[0, 0.42], [0.65, 0.3], [1.05, 0.7]] as ReadonlyArray<readonly [delay: number, duration: number]>,
  frequency: [380, 420] as Range,
  volume: 0.012,
}
/** bats squeaking past, rarely */
const bats = {
  rate: 0.06,
  squeaks: [2, 3] as Range,
  spacing: 0.07,
  volume: 0.0015,
}
/** a music box somewhere playing a short phrase in A minor pentatonic, each note a step up or down from the last, so it sounds like a tune rather than random notes */
const musicBox = {
  rate: 1 / 14,
  notes: [440, 523.3, 587.3, 659.3, 784, 880, 1046.5],
  count: [3, 5] as Range,
  spacing: 0.32,
  volume: 0.006,
}

/** The Halloween Orb’s night out: a breeze in dry leaves and, every so often, a cricket, an owl, bats or a music box tinkling somewhere. */
export default class HalloweenAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-halloween',
      title: 'Halloween night',
      gain: 0.4,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(crickets.rate, from, until)) {
      const frequency = this.vary(crickets.frequency)
      const volume = this.vary(crickets.volume)
      const pulses = Math.round(this.vary(crickets.pulses))
      for (let i = 0; i < pulses; i++) {
        this.chirp(time + i * crickets.spacing, 0.03, volume, frequency, frequency * 0.97)
      }
    }
    for (const time of this.scatter(owl.rate, from, until)) {
      const frequency = this.vary(owl.frequency)
      for (const [delay, duration] of owl.hoots) {
        this.swell(time + delay, duration, owl.volume, frequency, {
          attack: 0.08,
          endFrequency: frequency * 0.88,
        })
      }
    }
    for (const time of this.scatter(bats.rate, from, until)) {
      const squeaks = Math.round(this.vary(bats.squeaks))
      for (let i = 0; i < squeaks; i++) {
        this.chirp(time + i * bats.spacing, 0.02, bats.volume, 7000, 5000)
      }
    }
    for (const time of this.scatter(musicBox.rate, from, until)) {
      this.playPhrase(time)
    }
  }

  /** A few notes of the music box, wandering stepwise through its scale from a random one. */
  private playPhrase(time: number) {
    const {notes} = musicBox
    let index = Math.floor(Math.random() * notes.length)
    const count = Math.round(this.vary(musicBox.count))
    for (let i = 0; i < count; i++) {
      const note = notes[index]
      // A tine rings with a quieter, inharmonic partial that dies away first.
      this.chirp(time + i * musicBox.spacing, 1.8, musicBox.volume, note)
      this.chirp(time + i * musicBox.spacing, 0.5, musicBox.volume * 0.25, note * 2.76)
      // A step off the end of the scale turns back.
      const step = Math.random() < 0.5 ? -1 : 1
      const next = index + step
      index = next < 0 || next >= notes.length ? index - step : next
    }
  }
}
