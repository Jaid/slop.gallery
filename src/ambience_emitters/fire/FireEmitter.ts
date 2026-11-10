import type {EmitterPlacement} from '../lib/EmitterPlacement.ts'
import type {NoiseBed, Range} from 'ambience-emitter'

import AmbienceEmitter from 'ambience-emitter'

/** a log fire’s body: a low, slowly breathing roar, the wavering draw of the chimney and a faint hiss of gas escaping the wood */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'lowpass',
    frequency: 220,
    stages: 3,
    volume: 0.055,
    sway: [0.45, 0.55],
  },
  {
    filter: 'bandpass',
    frequency: 520,
    q: 0.9,
    stages: 2,
    volume: 0.006,
    sway: [0.35, 0.8],
    drift: [0.25, 500],
  },
  {
    filter: 'highpass',
    frequency: 4800,
    stages: 2,
    volume: 0.0018,
    sway: [0.6, 0.85],
    drift: [0.4, 300],
  },
]
/** clusters of fine ticks, like resin cells bursting one after another */
const crackles = {
  /** clusters per second */
  rate: 2.6,
  /** ticks per cluster */
  count: [1, 5] as Range,
  /** mean seconds between the ticks of a cluster */
  gap: 0.035,
  frequency: [2200, 7500] as Range,
  duration: [0.0015, 0.007] as Range,
  volume: [0.015, 0.09] as Range,
}
/** the occasional pop of a pocket of sap: a soft knock in the wood with a bright snap on top, sometimes trailing a hiss of steam */
const pops = {
  rate: 0.22,
  knock: [170, 320] as Range,
  knockDuration: [0.04, 0.09] as Range,
  /** share of pops that hiss afterward */
  steam: 0.4,
}
/** now and then the pile settles: a dull thud as a log shifts, then embers crumbling */
const settles = {
  rate: 0.025,
  thud: [80, 130] as Range,
  duration: [0.45, 0.8] as Range,
}

/** A log fire, like the Lodge’s: a breathing roar under clustered crackles, occasional sap pops with a hiss of steam and a log settling now and then. It is best placed just above the logs. */
export default class FireEmitter extends AmbienceEmitter {
  constructor({id, position, rooms}: EmitterPlacement) {
    super({
      id,
      title: 'Log fire',
      position,
      hearing: {
        near: 1,
        far: 14,
      },
      gain: 0.3,
      rooms,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override schedule(from: number, until: number) {
    for (const time of this.scatter(crackles.rate, from, until)) {
      const count = Math.round(this.vary(crackles.count))
      let tick = time
      for (let i = 0; i < count; i++) {
        // Mostly faint ticks with the occasional sharp one, each a little brighter or duller than the last.
        const volume = crackles.volume[0] + (crackles.volume[1] - crackles.volume[0]) * Math.random() ** 3
        this.burst(tick, this.vary(crackles.duration), volume, this.vary(crackles.frequency), 1.2)
        tick -= Math.log(1 - Math.random()) * crackles.gap
      }
    }
    for (const time of this.scatter(pops.rate, from, until)) {
      this.burst(time, this.vary(pops.knockDuration), 0.11, this.vary(pops.knock), 1.4)
      this.burst(time + 0.002, 0.006, 0.12, this.vary([3500, 6500]), 1.5)
      if (Math.random() < pops.steam) {
        this.burst(time + 0.03, this.vary([0.25, 0.6]), 0.012, this.vary([6000, 9000]), 0.9, 0.06)
      }
    }
    for (const time of this.scatter(settles.rate, from, until)) {
      this.burst(time, this.vary(settles.duration), 0.09, this.vary(settles.thud), 0.8, 0.02)
      // Embers crumble for a moment after.
      for (let i = 0; i < 9; i++) {
        this.burst(time + 0.08 + Math.random() * 0.6, this.vary([0.003, 0.012]), this.vary([0.01, 0.04]), this.vary([1500, 5000]), 1)
      }
    }
  }
}
