import type {NoiseBed} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** A low wind over a frozen lake. Its high, narrow whistle wanders independently of the gusts. */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'lowpass',
    frequency: 360,
    stages: 2,
    volume: 0.17,
    sway: [0.13, 0.63],
  },
  {
    filter: 'bandpass',
    frequency: 780,
    q: 3,
    stages: 2,
    volume: 0.052,
    sway: [0.19, 0.84],
    drift: [0.08, 740],
  },
]

export default class FrostAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-frost',
      title: 'Singing ice',
      gain: 0.54,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    // The dispersive call of ice under tension: high and glassy at first, then a low note traveling away under the sheet.
    for (const start of this.scatter(0.19, from, until)) {
      const pitch = this.vary([240, 380])
      this.chirp(start, 0.45, 0.017, pitch * 4.8, pitch)
      this.swell(start + 0.05, 1.3, 0.012, pitch, {
        attack: 0.16,
        endFrequency: pitch * 0.83,
      })
    }
  }
}
