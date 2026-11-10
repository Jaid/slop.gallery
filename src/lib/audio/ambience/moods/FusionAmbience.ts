import type {Range, ToneBed} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** a transformer’s hum somewhere in the walls: the mains and its first overtone, beating so slowly that it only breathes */
const tones: ReadonlyArray<ToneBed> = [
  {
    frequency: 50,
    beat: 0.2,
    volume: 0.008,
    sway: [0.06, 0.4],
  },
  {
    frequency: 100,
    beat: 0.35,
    type: 'triangle',
    volume: 0.003,
    sway: [0.09, 0.6],
  },
]
/** static snapping on and on in the charged air: single clicks, far brighter and shorter than anything burning */
const snaps = {
  /** snaps per second where the static is thickest */
  rate: 8,
  frequency: [5000, 9000] as Range,
  duration: [0.0015, 0.005] as Range,
  volume: [0.025, 0.06] as Range,
}
/** now and then, a spark jumping a gap: a short buzz at the mains’ overtones under a fizz */
const arcs = {
  rate: 0.25,
  frequency: [96, 124] as Range,
  duration: [0.06, 0.22] as Range,
  volume: [0.02, 0.04] as Range,
}
/** How thick the static is `time` seconds in, 0.2–1: two slow waves out of step, so it never settles into a cycle. */
const density = (time: number) => 0.6 + 0.25 * Math.sin(time * 0.37) + 0.15 * Math.sin(time * 0.113 + 1.7)

/** The air charged while a fusion brews: a transformer humming in the walls, static snapping on and on, thickening and thinning slowly, and now and then a spark arcing with a buzz. */
export default class FusionAmbience extends AmbienceLoop {
  constructor() {
    super({
      id: 'mood-fusion',
      title: 'Fusion',
      gain: 0.13,
    })
  }

  protected override get tones() {
    return tones
  }

  protected override schedule(from: number, until: number) {
    // Thinning the densest streams keeps them random while their density wanders.
    for (const time of this.scatter(snaps.rate, from, until)) {
      if (Math.random() <= density(time)) {
        this.burst(time, this.vary(snaps.duration), this.vary(snaps.volume), this.vary(snaps.frequency), 0.8, 0.0005)
      }
    }
    for (const time of this.scatter(arcs.rate, from, until)) {
      if (Math.random() > density(time)) {
        continue
      }
      const duration = this.vary(arcs.duration)
      const volume = this.vary(arcs.volume)
      this.swell(time, duration, volume, this.vary(arcs.frequency), {
        attack: 0.004,
        type: 'sawtooth',
      })
      this.burst(time, duration, volume * 0.5, 7000, 1.2, 0.003)
    }
  }
}
