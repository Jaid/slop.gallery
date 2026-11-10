import type {NoiseBed, Range, ToneBed} from '../src/main.ts'

import {afterEach, beforeEach, expect, jest, spyOn, test} from 'bun:test'

import {absorptionCutoff, openCutoff} from 'procedural-audio'

import AmbienceEmitter, {AmbienceLoop} from '../src/main.ts'
import audioFixture from './audioFixture.ts'

const beds: ReadonlyArray<NoiseBed> = [
  {
    filter: 'bandpass',
    frequency: 1300,
    stages: 2,
    volume: 0.04,
    sway: [3, 0.25],
    drift: [0.6, 450],
  },
  {
    filter: 'lowpass',
    frequency: 320,
    volume: 0.05,
  },
]
const tones: ReadonlyArray<ToneBed> = [
  {
    frequency: 55,
    beat: 0.3,
    volume: 0.05,
  },
]
/** a loop that keeps the windows it was asked to schedule */
class Wind extends AmbienceLoop {
  readonly windows: Array<Range> = []

  constructor(gain?: number) {
    super({
      id: 'wind',
      title: 'Wind',
      gain,
    })
  }

  protected override get beds() {
    return beds
  }

  protected override get tones() {
    return tones
  }

  protected override schedule(from: number, until: number) {
    this.windows.push([from, until])
    this.chirp(from, 0.03, 0.02, 900, 1400)
    this.burst(from, 0.05, 0.02, 3000)
    this.swell(from, 2, 0.01, 600, {vibrato: [4.5, 5]})
  }

  times(rate: number, from: number, until: number) {
    return [...this.scatter(rate, from, until)]
  }

  varied(range: Range) {
    return this.vary(range)
  }
}
class Spring extends AmbienceEmitter {
  constructor(rooms?: ReadonlyArray<string>) {
    super({
      id: 'spring',
      title: 'Spring',
      position: [1, 2, 3],
      hearing: {
        near: 1,
        far: 21,
      },
      gain: 0.3,
      rooms,
    })
  }

  protected override get beds() {
    return beds.slice(1)
  }
}
let fixture: ReturnType<typeof audioFixture>
beforeEach(() => {
  jest.useFakeTimers()
  fixture = audioFixture()
})
afterEach(() => {
  fixture.restore()
  jest.useRealTimers()
})
const output = () => ({
  context: fixture.context,
  master: fixture.context.destination,
})
test('constructing a loop is silent, and starting it builds its beds and tones once', () => {
  const wind = new Wind(0.5)
  expect(wind.playing).toBe(false)
  expect(fixture.sources).toEqual([])
  wind.start(output())
  expect(wind.playing).toBe(true)
  const [level, bus] = fixture.gains
  expect(level.gain.value).toBe(0.5)
  expect(bus.gain.value).toBe(0)
  expect(bus.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.2)
  expect(level.connect).toHaveBeenCalledWith(fixture.context.destination)
  // The first bed passes two filters in a row, the second one.
  expect(fixture.filters.slice(0, 3).map(filter => [filter.type, filter.frequency.value])).toEqual([['bandpass', 1300], ['bandpass', 1300], ['lowpass', 320]])
  // Looping: the swaying bed’s curve and noise and its drift, the plain bed’s noise and the beating tone’s two oscillators.
  const looping = fixture.sources.filter(source => source.loop)
  expect(looping).toHaveLength(4)
  expect(fixture.sources.filter(source => source.frequency.value === 55 || source.frequency.value === 55.3)).toHaveLength(2)
  const count = fixture.sources.length
  wind.start(output())
  expect(fixture.sources).toHaveLength(count)
})
test('one-shots are scheduled in windows that follow each other without a gap', () => {
  const wind = new Wind
  wind.start(output())
  expect(wind.windows).toEqual([[0, 0.25]])
  fixture.context.currentTime = 0.08
  jest.advanceTimersByTime(80)
  fixture.context.currentTime = 0.16
  jest.advanceTimersByTime(80)
  expect(wind.windows.map(([from]) => from)).toEqual([0, 0.25, 0.25 + 0.08])
  for (const [index, [from, until]] of wind.windows.entries()) {
    expect(until).toBeGreaterThan(from)
    expect(from).toBe(index ? wind.windows[index - 1][1] : 0)
  }
  // Timers held back, like in a hidden tab, skip what would already be over.
  fixture.context.currentTime = 5
  jest.advanceTimersByTime(80)
  expect(wind.windows.at(-1)).toEqual([5, 5.25])
})
test('every one-shot releases its nodes when it ends', () => {
  const wind = new Wind
  wind.start(output())
  const shots = fixture.sources.filter(source => source.stop.mock.calls.length)
  // A chirp, a burst, and a swell with its vibrato.
  expect(shots).toHaveLength(4)
  for (const shot of shots) {
    shot.dispatchEvent(new Event('ended'))
    expect(shot.disconnect).toHaveBeenCalled()
  }
})
test('stopping fades out, stops what loops and lets go of the output once it has rung out', () => {
  const wind = new Wind
  wind.start(output())
  const [level, bus] = fixture.gains
  const looping = fixture.sources.filter(source => !source.stop.mock.calls.length)
  fixture.context.currentTime = 3
  wind.stop(0.4)
  expect(wind.playing).toBe(false)
  expect(bus.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 3, 0.1)
  for (const source of looping) {
    expect(source.stop).toHaveBeenCalledWith(3.4)
  }
  expect(level.disconnect).not.toHaveBeenCalled()
  fixture.timers[0].dispatchEvent(new Event('ended'))
  expect(level.disconnect).toHaveBeenCalledTimes(1)
  const windows = wind.windows.length
  jest.advanceTimersByTime(800)
  expect(wind.windows).toHaveLength(windows)
  wind.stop()
  // It starts anew on whatever output comes next.
  wind.start(output())
  expect(wind.playing).toBe(true)
})
test('a level set while stopped holds for the next start', () => {
  const wind = new Wind(0.5)
  wind.setLevel(0.2)
  wind.start(output(), 0)
  const [level, bus] = fixture.gains
  expect(level.gain.value).toBeCloseTo(0.1)
  expect(bus.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0)
  fixture.context.currentTime = 1
  wind.setLevel(1, 0.05)
  expect(level.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.5, 1, 0.05)
})
test('scattered times fall into their window at about the asked rate, and varied values into their range', () => {
  const wind = new Wind
  const times = wind.times(30, 10, 110)
  expect(times.length).toBeGreaterThan(2700)
  expect(times.length).toBeLessThan(3300)
  expect(times.every(time => time >= 10 && time < 110)).toBe(true)
  expect(times).toEqual(times.toSorted((a, b) => a - b))
  for (let i = 0; i < 200; i++) {
    const value = wind.varied([450, 3200])
    expect(value).toBeGreaterThanOrEqual(450)
    expect(value).toBeLessThan(3200)
  }
})
test('an emitter is heard through a panner where it stands, with the air between it and the listener', () => {
  const spring = new Spring
  // Unstarted, hearing it builds nothing, but it remembers how muffled it is.
  spring.hear([1, 2, 13])
  expect(spring.playing).toBe(false)
  expect(fixture.panners).toEqual([])
  spring.start(output())
  const [panner] = fixture.panners
  expect(panner.options).toMatchObject({
    panningModel: 'HRTF',
    distanceModel: 'linear',
    refDistance: 1,
    maxDistance: 21,
    positionX: 1,
    positionY: 2,
    positionZ: 3,
  })
  const absorption = fixture.filters.find(filter => filter.Q.value === 0.5)!
  expect(absorption.frequency.value).toBeCloseTo(absorptionCutoff(0.45))
  expect(fixture.gains[0].connect).toHaveBeenCalledWith(panner)
  expect(panner.connect).toHaveBeenCalledWith(absorption)
  expect(absorption.connect).toHaveBeenCalledWith(fixture.context.destination)
  // A listener standing still retunes nothing, one walking up opens it again.
  spring.hear([1, 2, 13])
  spring.hear([1, 2, 13.01])
  expect(absorption.frequency.setTargetAtTime).not.toHaveBeenCalled()
  fixture.context.currentTime = 2
  spring.hear([1, 2, 3.5])
  expect(absorption.frequency.setTargetAtTime).toHaveBeenLastCalledWith(openCutoff, 2, 0.05)
  spring.hear([1, 2, 23], {fading: false})
  expect(absorption.frequency.setTargetAtTime).toHaveBeenLastCalledWith(absorptionCutoff(0.95), 2, 0)
})
test('an emitter heard from farther away is quieter, and silent outside its rooms', () => {
  const spring = new Spring(['lobby'])
  const {far, near} = spring.hearing
  expect(spring.strengthAt([1 + near / 2, 2, 3], 'lobby')).toBe(1)
  expect(spring.strengthAt([1 + (near + far) / 2, 2, 3], 'lobby')).toBeCloseTo(0.5)
  expect(spring.strengthAt([1, 2, 3], 'vesper')).toBe(0)
  expect(spring.strengthAt([1, 2, 3])).toBe(1)
  expect(spring.isInside('lobby')).toBe(true)
  expect(spring.isInside('vesper')).toBe(false)
  const everywhere = new Spring
  expect(everywhere.isInside('vesper')).toBe(true)
  expect(everywhere.strengthAt([1, 2, 3], 'vesper')).toBe(1)
})
test('an emitter fades out and in again as the listener leaves and enters its rooms, or cuts without fading', () => {
  const spring = new Spring(['lobby'])
  const setLevel = spyOn(spring, 'setLevel')
  spring.hear([0, 0, 0], {room: 'vesper'})
  spring.hear([0, 0, 0], {
    room: 'lobby',
    fading: false,
  })
  spring.hear([0, 0, 0], {
    room: 'lobby',
    fading: false,
  })
  // Without a room, it stays as it is.
  spring.hear([0, 0, 0])
  spring.hear([0, 0, 0], {
    room: 'vesper',
    fading: false,
  })
  expect(setLevel.mock.calls).toEqual([[0, undefined], [1, 0], [0, 0]])
})
