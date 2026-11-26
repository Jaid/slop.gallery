import type {NoiseBed, Range} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** sub-zero arctic wind: a deep hollow gale beneath a fine whistling spindrift of dry snow */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 240,
    q: 1.6,
    stages: 3,
    volume: 0.095,
    sway: [0.11, 0.38],
    drift: [0.06, 150],
  },
  {
    filter: 'bandpass',
    frequency: 980,
    q: 2.8,
    stages: 2,
    volume: 0.024,
    sway: [0.16, 0.55],
    drift: [0.08, 420],
  },
]
/** brittle ice crystals ticking and snapping as hoarfrost spreads */
const crackles = {
  rate: 1 / 3.5,
  count: [1, 3] as Range,
  spacing: [0.09, 0.26] as Range,
  frequency: [2800, 5600] as Range,
  duration: [0.025, 0.06] as Range,
  volume: [0.012, 0.024] as Range,
}
/** distant frozen lake ice singing with glassy crystalline chimes */
const chimes = {
  rate: 1 / 7,
  frequency: [1760, 3520] as Range,
  volume: [0.006, 0.012] as Range,
}

/** The Frost Orb’s deep freeze: hollow arctic wind, whistling spindrift snow, brittle hoarfrost crackles and faint crystalline ice chimes. */
export default class FrostAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-frost',
      title: 'Deep Freeze',
      gain: 0.72,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(crackles.rate, from, until)) {
      const count = Math.round(this.vary(crackles.count))
      let at = time
      for (let i = 0; i < count; i++) {
        const duration = this.vary(crackles.duration)
        this.burst(at, duration, this.vary(crackles.volume), this.vary(crackles.frequency), 2.2, duration * 0.12)
        at += this.vary(crackles.spacing)
      }
    }
    for (const time of this.scatter(chimes.rate, from, until)) {
      const frequency = this.vary(chimes.frequency)
      const volume = this.vary(chimes.volume)
      this.chirp(time, 0.42, volume, frequency)
      this.chirp(time + 0.01, 0.18, volume * 0.35, frequency * 2.756)
    }
  }
}
