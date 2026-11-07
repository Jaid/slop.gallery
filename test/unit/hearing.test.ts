import {expect, spyOn, test} from 'bun:test'

import Fountain from '../../src/lib/audio/ambience/Fountain.ts'
import {absorptionCutoff, hearingShare, openCutoff} from '../../src/lib/audio/hearing.ts'

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
})
test('an emitter heard from farther away is muffled and quieter, and silent outside its rooms', () => {
  const fountain = new Fountain([0, 0, 0], ['lobby'])
  const {far, near} = fountain.hearing
  expect(fountain.strengthAt([near / 2, 0, 0], 'lobby')).toBe(1)
  expect(fountain.strengthAt([(near + far) / 2, 0, 0], 'lobby')).toBeCloseTo(0.5)
  expect(fountain.strengthAt([0, 0, 0], 'vesper')).toBe(0)
  // Unstarted, hearing it builds nothing.
  fountain.hear([far, 0, 0], 'lobby')
  fountain.hear([0, 0, 0], 'vesper')
  expect(fountain.playing).toBe(false)
})
test('an emitter fades out and in again as the listener leaves and enters its rooms, or cuts without fading', () => {
  const fountain = new Fountain([0, 0, 0], ['lobby'])
  const setLevel = spyOn(fountain, 'setLevel')
  fountain.hear([0, 0, 0], 'vesper')
  fountain.hear([0, 0, 0], 'lobby', false)
  fountain.hear([0, 0, 0], 'lobby', false)
  fountain.hear([0, 0, 0], 'vesper', false)
  expect(setLevel.mock.calls).toEqual([[0, undefined], [1, 0], [0, 0]])
})
