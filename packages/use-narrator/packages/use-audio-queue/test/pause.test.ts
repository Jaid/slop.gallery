import type {AudioPlayback} from '../src/types.ts'

import {expect, test} from 'bun:test'

import AudioQueue from '../src/AudioQueue.ts'
import {FakeClock, FakePlayback, flush} from './helpers.ts'

test('global pause preserves every lane, pending order and transport position', async () => {
  using queue = new AudioQueue
  const original = new FakePlayback('original')
  const injected = new FakePlayback('injected')
  const concurrent = new FakePlayback('concurrent')
  const later = new FakePlayback('later')
  queue.push(() => original)
  queue.push(() => later)
  queue.push(() => concurrent, {priority: 'async'})
  await flush()
  queue.push(() => injected, {priority: 'inject'})
  await flush()
  injected.position = 12
  queue.paused = true
  queue.paused = true
  expect([original, injected, concurrent].map(playback => playback.playing)).toEqual([false, false, false])
  expect([original, injected, concurrent].map(playback => playback.pauses)).toEqual([1, 1, 1])
  expect(queue.getSnapshot().current?.suspended).toBe(true)
  expect(queue.getSnapshot().concurrent[0].suspended).toBe(true)
  queue.paused = false
  await flush()
  expect(injected.playing).toBe(true)
  expect(injected.position).toBe(12)
  expect(concurrent.playing).toBe(true)
  expect(original.playing).toBe(false)
  injected.end()
  await flush()
  expect(original.playing).toBe(true)
  original.end()
  await flush()
  expect(later.playing).toBe(true)
})
test('pause preserves both silent phases and the inter-entry gap', async () => {
  const clock = new FakeClock
  using queue = new AudioQueue({
    clock,
    gap: 2,
    prependedSilence: 1,
    appendedSilence: 1,
  })
  const first = new FakePlayback
  const second = new FakePlayback
  const handle = queue.push(() => first)
  queue.push(() => second)
  await clock.advance(0.4)
  queue.paused = true
  expect(clock.size).toBe(0)
  expect(queue.getSnapshot().current?.phaseEndsAt).toBeUndefined()
  await clock.advance(100)
  queue.paused = false
  await clock.advance(0.59)
  expect(first.playing).toBe(false)
  await clock.advance(0.01)
  expect(first.playing).toBe(true)
  first.end()
  await clock.advance(0.3)
  queue.paused = true
  await clock.advance(100)
  queue.paused = false
  await clock.advance(0.7)
  expect(await handle.finished).toEqual({status: 'completed'})
  await clock.advance(0.99)
  expect(second.playing).toBe(false)
  await clock.advance(0.01)
  expect(second.playing).toBe(true)
})
test('late preparation and new requests cannot play through a pause, including injected and concurrent work', async () => {
  using queue = new AudioQueue
  const preparation = Promise.withResolvers<FakePlayback>()
  queue.push(() => preparation.promise)
  await flush()
  queue.paused = true
  const original = new FakePlayback
  preparation.resolve(original)
  const async = new FakePlayback
  const injected = new FakePlayback
  queue.push(() => async, {priority: 'async'})
  queue.push(() => injected, {priority: 'inject'})
  await flush()
  expect([original, async, injected].map(playback => playback.plays)).toEqual([0, 0, 0])
  queue.paused = false
  await flush()
  expect([original, async, injected].map(playback => playback.plays)).toEqual([0, 1, 1])
  injected.end()
  await flush()
  expect(original.playing).toBe(true)
})
test('pausing a pending play ignores its stale rejection and resumes without canceling', async () => {
  using queue = new AudioQueue
  const playback = new FakePlayback
  const starting = Promise.withResolvers<void>()
  ;(playback as AudioPlayback).play = () => starting.promise
  const handle = queue.push(() => playback)
  await flush()
  queue.paused = true
  starting.reject(new Error('Interrupted play'))
  await flush()
  expect(queue.has(handle.id)).toBe(true)
  playback.play = () => {
    playback.playing = true
  }
  queue.paused = false
  await flush()
  expect(playback.playing).toBe(true)
})
test('canceling and replacing jobs while paused never starts another lane', async () => {
  using queue = new AudioQueue
  const original = new FakePlayback
  const handle = queue.push(() => original)
  await flush()
  queue.paused = true
  const replacement = new FakePlayback
  queue.push(() => replacement, {priority: 'destructive'})
  await flush()
  const result = await handle.finished
  expect(result.status).toBe('cancelled')
  expect(replacement.plays).toBe(0)
  queue.clear()
  queue.paused = false
  await flush()
  expect(queue.getSnapshot().idle).toBe(true)
  expect(replacement.plays).toBe(0)
})
test('a completion delivered while paused still preserves the following gap', async () => {
  const clock = new FakeClock
  using queue = new AudioQueue({
    clock,
    gap: 2,
  })
  const first = new FakePlayback
  const second = new FakePlayback
  queue.push(() => first)
  queue.push(() => second)
  await flush()
  first.end()
  // The completion promise’s handler has not run yet.
  queue.paused = true
  await clock.advance(60)
  queue.paused = false
  await clock.advance(1.99)
  expect(second.playing).toBe(false)
  await clock.advance(0.01)
  expect(second.playing).toBe(true)
})
