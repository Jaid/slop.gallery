import type {Voice} from '../src/main.ts'

import {afterEach, beforeEach, expect, mock, test} from 'bun:test'

import playVoices, {absorptionCutoff, atContextTime, hearingPath, hearingShare, listenerPosition, loopLength, noise, openCutoff, osc, scaleVoices, shiftVoices, swayCurve, whiteNoise} from '../src/main.ts'
import audioFixture from './audioFixture.ts'

let fixture: ReturnType<typeof audioFixture>
beforeEach(() => {
  fixture = audioFixture()
})
afterEach(() => {
  fixture.restore()
})
const output = () => ({
  context: fixture.context,
  master: fixture.context.destination,
})
const knock: ReadonlyArray<Voice> = [
  osc(165, 0.16, 0.042, {endFrequency: 49}),
  noise(0.045, 0.02, {
    type: 'lowpass',
    frequency: 980,
    endFrequency: 320,
  }, {delay: 0.1}),
]
/** Ends every source the playback started, like the context does once they have played. */
const end = () => {
  for (const source of fixture.sources) {
    source.dispatchEvent(new Event('ended'))
  }
}
test('recipes are plain data that shifts and scales', () => {
  expect(osc(440, 0.2, 0.03)).toEqual({
    kind: 'oscillator',
    type: 'sine',
    frequency: 440,
    duration: 0.2,
    volume: 0.03,
  })
  expect(osc(440, 0.2, 0.03, {
    type: 'square',
    delay: 0.1,
  }).type).toBe('square')
  expect(noise(0.1, 0.02, {
    type: 'bandpass',
    frequency: 4200,
  }, {attack: 0.001})).toEqual({
    kind: 'noise',
    duration: 0.1,
    volume: 0.02,
    filter: {
      type: 'bandpass',
      frequency: 4200,
    },
    attack: 0.001,
  })
  expect(shiftVoices(knock, 0.5).map(voice => voice.delay)).toEqual([0.5, 0.6])
  expect(scaleVoices(knock, 2).map(voice => voice.volume)).toEqual([0.084, 0.04])
  // The recipe itself stays as it was.
  expect(knock[0].delay).toBeUndefined()
  expect(knock[0].volume).toBe(0.042)
})
test('a playback schedules every voice from now on, silent until its onset', () => {
  fixture.context.currentTime = 2
  const playback = playVoices(output(), knock, {gain: 0.5})
  const [bus, tone, hiss] = fixture.gains
  expect(playback.gain).toBe(bus.gain as unknown as AudioParam)
  expect(bus.gain.value).toBe(0.5)
  expect(bus.connect).toHaveBeenCalledWith(fixture.destination)
  expect(fixture.sources).toHaveLength(2)
  const [oscillator, noiseSource] = fixture.sources
  expect(tone.gain.value).toBe(0)
  expect(tone.gain.setValueAtTime).toHaveBeenCalledWith(0, 2)
  expect(tone.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.042, 2.003)
  expect(tone.gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(2.16)
  expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(165, 2)
  expect(oscillator.frequency.exponentialRampToValueAtTime.mock.calls[0][0]).toBe(49)
  expect(oscillator.start).toHaveBeenCalledWith(2)
  expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(2.16)
  expect(hiss.gain.setValueAtTime).toHaveBeenCalledWith(0, 2.1)
  expect(noiseSource.start).toHaveBeenCalledWith(2.1)
  expect(fixture.filters).toHaveLength(1)
  expect(fixture.filters[0].type).toBe('lowpass')
  expect(fixture.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(980, 2.1)
  expect(noiseSource.connect).toHaveBeenCalledWith(fixture.filters[0])
})
test('the seed makes the noise: the same one the same, another one another', () => {
  playVoices(output(), knock, {seed: 'a'})
  playVoices(output(), knock, {seed: 'a'})
  playVoices(output(), knock, {seed: 'b'})
  playVoices(output(), [knock[1], knock[1]], {seed: 'a'})
  const [first, again, other, layerOne, layerTwo] = fixture.buffers
  expect(first).toHaveLength(Math.ceil(8000 * 0.045))
  expect(again).toEqual(first)
  expect(other).not.toEqual(first)
  // Two noise voices of one recipe never sound alike either.
  expect(layerTwo).not.toEqual(layerOne)
  expect(Math.max(...first)).toBeLessThanOrEqual(1)
  expect(Math.min(...first)).toBeGreaterThanOrEqual(-1)
  expect(Math.abs(first.reduce((sum, sample) => sum + sample, 0) / first.length)).toBeLessThan(0.15)
})
test('a duration fits the whole recipe, delays included', () => {
  playVoices(output(), knock, {duration: 0.32})
  const [oscillator, noiseSource] = fixture.sources
  // The recipe lasts 0.16 s, so everything takes twice as long.
  expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(0.32)
  expect(noiseSource.start.mock.calls[0][0]).toBeCloseTo(0.2)
  expect(fixture.gains[1].gain.linearRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(0.006)
})
test('a playback releases its nodes once every voice has ended, and never the output', () => {
  const onEnded = mock(() => {})
  playVoices(output(), knock, {onEnded})
  const [bus, tone] = fixture.gains
  fixture.sources[0].dispatchEvent(new Event('ended'))
  expect(tone.disconnect).toHaveBeenCalledTimes(1)
  expect(bus.disconnect).not.toHaveBeenCalled()
  expect(onEnded).not.toHaveBeenCalled()
  fixture.sources[1].dispatchEvent(new Event('ended'))
  expect(bus.disconnect).toHaveBeenCalledTimes(1)
  expect(fixture.filters[0].disconnect).toHaveBeenCalledTimes(1)
  expect(onEnded).toHaveBeenCalledTimes(1)
  expect(fixture.destination.disconnect).not.toHaveBeenCalled()
})
test('stopping fades out once and stops every source', () => {
  const playback = playVoices(output(), knock)
  fixture.context.currentTime = 0.05
  playback.stop()
  playback.stop()
  const [bus] = fixture.gains
  expect(bus.gain.cancelAndHoldAtTime).toHaveBeenCalledTimes(1)
  expect(bus.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.05 + 0.025)
  for (const source of fixture.sources) {
    expect(source.stop).toHaveBeenLastCalledWith(0.05 + 0.025)
  }
  // A playback that has ended has nothing left to stop.
  const ended = playVoices(output(), knock)
  end()
  ended.stop()
  expect(fixture.gains[3].gain.cancelAndHoldAtTime).not.toHaveBeenCalled()
})
test('a sustained playback holds its envelopes and loops its noise until stopped', () => {
  const playback = playVoices(output(), knock, {sustain: true})
  const [, tone] = fixture.gains
  const [oscillator, noiseSource] = fixture.sources
  expect(tone.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled()
  expect(oscillator.stop).not.toHaveBeenCalled()
  expect(noiseSource.loop).toBe(true)
  playback.stop(0.06)
  expect(oscillator.stop).toHaveBeenCalledWith(0.06)
})
test('a position puts the playback behind a panner and the air between it and the listener', () => {
  fixture.context.listener.positionZ.value = 14
  const onEnded = mock(() => {})
  playVoices(output(), knock, {
    position: [0, 1, 0],
    hearing: {
      near: 2,
      far: 26,
    },
    onEnded,
  })
  const [panner] = fixture.panners
  const [absorption] = fixture.filters
  expect(panner.options).toEqual({
    panningModel: 'HRTF',
    distanceModel: 'linear',
    refDistance: 2,
    maxDistance: 26,
    rolloffFactor: 1,
    positionX: 0,
    positionY: 1,
    positionZ: 0,
  })
  expect(fixture.gains[0].connect).toHaveBeenCalledWith(panner)
  expect(panner.connect).toHaveBeenCalledWith(absorption)
  expect(absorption.connect).toHaveBeenCalledWith(fixture.destination)
  // About halfway out, the air has taken most of the highs.
  expect(absorption.frequency.value).toBeCloseTo(absorptionCutoff(hearingShare([0, 1, 0], [0, 0, 14], {
    near: 2,
    far: 26,
  })))
  expect(absorption.frequency.value).toBeLessThan(openCutoff / 2)
  end()
  expect(panner.disconnect).toHaveBeenCalledTimes(1)
  expect(absorption.disconnect).toHaveBeenCalledTimes(1)
  expect(onEnded).toHaveBeenCalledTimes(1)
  // Without one, nothing stands between the playback and the output.
  playVoices(output(), knock)
  expect(fixture.panners).toHaveLength(1)
})
test('distance takes the highs, quickly at first, from all open nearby to a muffled wash at the edge of hearing', () => {
  expect(absorptionCutoff(0)).toBe(openCutoff)
  expect(absorptionCutoff(-1)).toBe(openCutoff)
  expect(absorptionCutoff(1)).toBeCloseTo(2200)
  expect(absorptionCutoff(2)).toBeCloseTo(2200)
  let previous = Infinity
  for (let share = 0; share <= 1; share += 0.05) {
    const cutoff = absorptionCutoff(share)
    expect(cutoff).toBeLessThan(previous)
    previous = cutoff
  }
  // Halfway out, most of the way down already, as far as the ear goes.
  expect(Math.log(openCutoff / absorptionCutoff(0.5)) / Math.log(openCutoff / 2200)).toBeGreaterThan(0.55)
})
test('how far along its hearing a listener is', () => {
  const hearing = {
    near: 2,
    far: 12,
  }
  expect(hearingShare([0, 0, 0], [1, 0, 0], hearing)).toBe(0)
  expect(hearingShare([0, 0, 0], [0, 7, 0], hearing)).toBeCloseTo(0.5)
  expect(hearingShare([0, 0, 0], [0, 0, 30], hearing)).toBe(1)
  fixture.context.listener.positionX.value = 3
  fixture.context.listener.positionY.value = 1.7
  expect(listenerPosition(fixture.context)).toEqual([3, 1.7, 0])
  // A path of its own takes the cutoff it is given.
  const path = hearingPath(fixture.context, [0, 0, 0], hearing, 5000)
  const [panner] = fixture.panners
  const [absorption] = fixture.filters
  expect(path.panner).toBe(panner as unknown as PannerNode)
  expect(path.absorption.frequency.value).toBe(5000)
  expect(panner.connect).toHaveBeenCalledWith(absorption)
  expect(absorption.connect).not.toHaveBeenCalled()
})
test('a callback waits for the context’s own clock, unless canceled', () => {
  const callback = mock(() => {})
  fixture.context.currentTime = 1
  atContextTime(fixture.context, 3, callback)
  const [timer] = fixture.timers
  expect(timer.offset.value).toBe(0)
  expect(timer.connect).toHaveBeenCalledWith(fixture.destination)
  expect(timer.stop).toHaveBeenCalledWith(3)
  expect(callback).not.toHaveBeenCalled()
  timer.dispatchEvent(new Event('ended'))
  expect(callback).toHaveBeenCalledTimes(1)
  expect(timer.disconnect).toHaveBeenCalledTimes(1)
  // A time that has passed is now.
  atContextTime(fixture.context, 0.5, callback)
  expect(fixture.timers[1].stop).toHaveBeenCalledWith(1)
  const cancel = atContextTime(fixture.context, 4, callback)
  cancel()
  cancel()
  fixture.timers[2].dispatchEvent(new Event('ended'))
  expect(callback).toHaveBeenCalledTimes(1)
  expect(fixture.timers[2].stop).toHaveBeenCalledTimes(2)
})
test('every context shares one buffer of white noise, and sway curves loop without a seam', () => {
  const shared = whiteNoise(fixture.context)
  expect(whiteNoise(fixture.context)).toBe(shared)
  const samples = shared.getChannelData(0)
  expect(samples).toHaveLength(8000 * loopLength)
  expect(Math.max(...samples)).toBeGreaterThan(0.99)
  expect(Math.min(...samples)).toBeLessThan(-0.99)
  const other = audioFixture()
  expect(whiteNoise(other.context)).not.toBe(shared)
  const curve = swayCurve(fixture.context, 2).getChannelData(0)
  expect(curve).toHaveLength(8000 * loopLength)
  expect(Math.min(...curve)).toBeGreaterThanOrEqual(0)
  expect(Math.max(...curve)).toBeLessThanOrEqual(1)
  // Smooth all the way, also from its last sample back to its first.
  let steepest = Math.abs(curve[0] - curve.at(-1)!)
  for (let i = 1; i < curve.length; i++) {
    steepest = Math.max(steepest, Math.abs(curve[i] - curve[i - 1]))
  }
  expect(steepest).toBeLessThan(0.001)
  expect(swayCurve(fixture.context, 2)).not.toEqual(swayCurve(fixture.context, 2))
})
