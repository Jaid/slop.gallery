import type {NoiseBed, Range, ToneBed} from 'ambience-emitter'

import {AmbienceLoop} from 'ambience-emitter'

/** a deep rumble and a slow, labored breath that wanders a little */
const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'lowpass',
    frequency: 90,
    stages: 3,
    volume: 0.08,
    sway: [0.12, 0.5],
  },
  {
    filter: 'bandpass',
    frequency: 600,
    q: 1.2,
    volume: 0.006,
    sway: [0.1, 0.9],
    drift: [0.05, 400],
  },
]
/** a low drone that throbs as slowly as breathing, with a tritone above it fading in and out */
const tones: ReadonlyArray<ToneBed> = [
  {
    frequency: 55,
    beat: 0.45,
    volume: 0.03,
    sway: [0.07, 0.4],
  },
  {
    frequency: 77.8,
    beat: 0.3,
    volume: 0.008,
    sway: [0.05, 0.8],
  },
]
/** a heartbeat that comes in spells, swelling and fading again, with long silences between them, so it never turns into a metronome */
const heartbeat = {
  /** beats per spell */
  beats: [5, 9] as Range,
  /** beats per minute, picked anew for every spell */
  tempo: [50, 58] as Range,
  /** seconds of silence between spells */
  rest: [8, 18] as Range,
  /** seconds from the lub to the dub */
  dub: 0.3,
  volume: 0.12,
}
/** single drops falling into a pool, rarely */
const drips = {
  rate: 0.12,
  frequency: [700, 1300] as Range,
  volume: [0.005, 0.012] as Range,
}
/** metal dragged slowly over stone, far off */
const scrapes = {
  rate: 1 / 25,
  frequency: [900, 1800] as Range,
  duration: [1.5, 2.5] as Range,
  volume: 0.006,
}

/** The Horror Orb’s dread: a drone and a rumble, a heartbeat that comes and goes, blood dripping and now and then something scraping in the dark. */
export default class HorrorAmbience extends AmbienceLoop {
  /** when the next heartbeat is due, in the audio context’s time */
  private nextBeat = 0
  /** the spell of heartbeats going on, or none during a silence */
  private spell?: {
    beat: number
    beats: number
    period: number
  }

  constructor() {
    super({
      id: 'mood-horror',
      title: 'Dread',
      gain: 0.3,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override get tones() {
    return tones
  }

  protected override schedule(from: number, until: number) {
    // A fresh start or timers held back skip the beats that were due meanwhile.
    if (this.nextBeat < from) {
      this.nextBeat = from
    }
    while (this.nextBeat < until) {
      this.spell ??= {
        beat: 0,
        beats: Math.round(this.vary(heartbeat.beats)),
        period: 60 / this.vary(heartbeat.tempo),
      }
      const {beat, beats, period} = this.spell
      // Each spell swells from its first beat to its middle and fades out to its last.
      const volume = heartbeat.volume * Math.sin(Math.PI * (beat + 0.5) / beats)
      this.thump(this.nextBeat, volume)
      this.thump(this.nextBeat + heartbeat.dub, volume * 0.7)
      this.spell.beat++
      if (this.spell.beat < beats) {
        this.nextBeat += period
      } else {
        this.spell = undefined
        this.nextBeat += period + this.vary(heartbeat.rest)
      }
    }
    for (const time of this.scatter(drips.rate, from, until)) {
      const frequency = this.vary(drips.frequency)
      this.chirp(time, 0.05, this.vary(drips.volume), frequency, frequency * 1.8)
    }
    for (const time of this.scatter(scrapes.rate, from, until)) {
      this.burst(time, this.vary(scrapes.duration), scrapes.volume, this.vary(scrapes.frequency), 6, 0.7)
    }
  }

  /** One beat of the heart: a low falling sine with a dull knock. */
  private thump(time: number, volume: number) {
    this.chirp(time, 0.14, volume, 72, 40)
    this.burst(time, 0.06, volume * 0.15, 110, 1)
  }
}
