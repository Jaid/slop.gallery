import type {Vec3} from '../../gallery/types.ts'
import type {NoiseBed, Range} from 'ambience-emitter'

import AmbienceEmitter from 'ambience-emitter'

import fountain from '../../gallery/fountain/config.ts'

/** water falling into water: a wandering mid-range plash, a low churn in the basin and a fine hiss of spray */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 1300,
    q: 0.7,
    stages: 2,
    volume: 0.035,
    sway: [3, 0.35],
    drift: [0.6, 450],
  },
  {
    filter: 'lowpass',
    frequency: 320,
    stages: 2,
    volume: 0.045,
    sway: [0.8, 0.3],
  },
  {
    filter: 'highpass',
    frequency: 6200,
    stages: 2,
    volume: 0.004,
    sway: [5, 0.6],
    drift: [1.2, 250],
  },
]
/** small bubbles closing under the veils: a sine whose pitch rises as it decays, smaller bubbles higher and shorter */
const drops = {
  rate: 30,
  frequency: [450, 3200] as Range,
  /** factor the pitch rises by */
  rise: [1.15, 1.9] as Range,
  duration: [0.012, 0.045] as Range,
  volume: [0.008, 0.07] as Range,
}
/** now and then a big bubble under the jet, low and round */
const glugs = {
  rate: 0.45,
  frequency: [170, 340] as Range,
  rise: [1.3, 1.7] as Range,
  duration: [0.07, 0.14] as Range,
  volume: [0.02, 0.045] as Range,
}
/** drops striking the pool’s surface */
const splashes = {
  rate: 4,
  frequency: [1500, 4800] as Range,
  q: 1.4,
  duration: [0.02, 0.08] as Range,
  volume: [0.01, 0.03] as Range,
}

/** The Lobby fountain: water falling from its veils into its pools, a plash over a low churn and a hiss of spray, full of small bubbles, the odd big one under the jet and drops striking the surface, sounding from the tip of its finial. */
export default class Fountain extends AmbienceEmitter {
  /** sounds from `position`, by default the finial’s tip, the main jet’s mouth, in `rooms`, by default only the Lobby */
  constructor(position: Vec3 = [fountain.position[0], fountain.position[1] + fountain.jet.y, fountain.position[2]], rooms: ReadonlyArray<string> = ['lobby']) {
    super({
      id: 'lobby-fountain',
      title: 'Fountain',
      position,
      hearing: {
        near: 1,
        // still faintly audible from the Lobby’s far north end, about 18 m away
        far: 21,
      },
      gain: 0.3,
      rooms,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(drops.rate, from, until)) {
      // Small bubbles outnumber big ones: the pitch leans high, and the high ones die faster.
      const size = Math.random() ** 0.6
      const frequency = drops.frequency[0] + (drops.frequency[1] - drops.frequency[0]) * size
      const duration = drops.duration[1] - (drops.duration[1] - drops.duration[0]) * size
      const volume = drops.volume[0] + (drops.volume[1] - drops.volume[0]) * Math.random() ** 2.5
      this.chirp(time, duration, volume, frequency, frequency * this.vary(drops.rise))
    }
    for (const time of this.scatter(glugs.rate, from, until)) {
      const frequency = this.vary(glugs.frequency)
      this.chirp(time, this.vary(glugs.duration), this.vary(glugs.volume), frequency, frequency * this.vary(glugs.rise))
    }
    for (const time of this.scatter(splashes.rate, from, until)) {
      this.burst(time, this.vary(splashes.duration), this.vary(splashes.volume), this.vary(splashes.frequency), splashes.q)
    }
  }
}
