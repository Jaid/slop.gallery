import type {AudioPlayback} from '../src/core.ts'

import {expect, test} from 'bun:test'

import {AudioQueue} from '../src/core.ts'
import {FakeClock, FakePlayback, flush} from './helpers.ts'

const setup = (options = {}) => {
  const clock = new FakeClock
  const queue = new AudioQueue({
    clock,
    ...options,
  })
  const players = new Map<string, FakePlayback>
  const push = (name: string, pushOptions: Parameters<typeof queue.push>[1] = {}) => {
    const player = new FakePlayback(name)
    players.set(name, player)
    return queue.push(() => player, pushOptions)
  }
  return {
    queue,
    clock,
    players,
    push,
  }
}
test('normal and high are stable FIFO lanes; high never interrupts current playback', async () => {
  const {queue, players, push} = setup()
  const a = push('a')
  const b = push('b')
  const c = push('c')
  const h1 = push('h1', {priority: 'high'})
  const h2 = push('h2', {priority: 'high'})
  await flush()
  expect(queue.getSnapshot().pending.map(job => job.id)).toEqual([h1.id, h2.id, b.id, c.id])
  for (const [name, handle] of [['a', a], ['h1', h1], ['h2', h2], ['b', b], ['c', c]] as const) {
    expect(queue.getSnapshot().current?.id).toBe(handle.id)
    expect(players.get(name)!.playing).toBe(true)
    players.get(name)!.end()
    await flush()
    expect(await handle.finished).toEqual({status: 'completed'})
  }
  expect(queue.getSnapshot().idle).toBe(true)
})
test('nested injections suspend and resume the same transport and position in LIFO order', async () => {
  const {queue, players, push} = setup()
  const a = push('a')
  const later = push('later')
  await flush()
  players.get('a')!.position = 3.5
  const first = push('first', {priority: 'inject'})
  await flush()
  players.get('first')!.position = 1.2
  const second = push('second', {priority: 'inject'})
  await flush()
  expect(queue.getSnapshot().interrupted.map(job => job.id)).toEqual([a.id, first.id])
  expect(players.get('a')!.pauses).toBe(1)
  expect(players.get('first')!.pauses).toBe(1)
  players.get('second')!.end()
  await flush()
  expect(await second.finished).toEqual({status: 'completed'})
  expect(players.get('first')!.position).toBe(1.2)
  expect(players.get('first')!.plays).toBe(2)
  players.get('first')!.end()
  await flush()
  expect(players.get('a')!.plays).toBe(2)
  expect(players.get('a')!.position).toBe(3.5)
  players.get('a')!.end()
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(later.id)
  queue.dispose()
})
test('destructive cancels current, suspended, queued and explicitly concurrent jobs', async () => {
  const {queue, players, push} = setup()
  const old = [push('a'), push('b')]
  await flush()
  old.push(push('injection', {priority: 'inject'}), push('parallel', {priority: 'async'}))
  await flush()
  const replacement = push('replacement', {priority: 'destructive'})
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(replacement.id)
  expect(queue.getSnapshot().pending).toHaveLength(0)
  expect(queue.getSnapshot().interrupted).toHaveLength(0)
  expect(queue.getSnapshot().concurrent).toHaveLength(0)
  for (const handle of old) {
    const result = await handle.finished
    expect(result.status).toBe('cancelled')
  }
  for (const name of ['a', 'injection', 'parallel']) {
    expect(players.get(name)!.disposals).toBe(1)
  }
  expect(players.get('b')!.plays).toBe(0)
  queue.dispose()
})
test('async bypasses the serial queue without advancing it on completion', async () => {
  const {queue, players, push} = setup()
  const a = push('a')
  const b = push('b')
  const parallel = push('parallel', {priority: 'async'})
  await flush()
  expect(players.get('a')!.playing).toBe(true)
  expect(players.get('parallel')!.playing).toBe(true)
  players.get('parallel')!.end()
  await flush()
  const parallelResult = await parallel.finished
  expect(parallelResult.status).toBe('completed')
  expect(queue.getSnapshot().current?.id).toBe(a.id)
  players.get('a')!.end()
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(b.id)
  queue.dispose()
})
for (const priority of ['normal', 'high', 'inject', 'async', 'destructive', 'volatile'] as const) {
  test(`shy yields permanently to ${priority}`, async () => {
    const {queue, players, push} = setup()
    const shy = push('shy', {priority: 'shy'})
    await flush()
    push('other', {priority})
    await flush()
    const shyResult = await shy.finished
    expect(shyResult.status).toBe('cancelled')
    expect(players.get('shy')!.disposals).toBe(1)
    players.get('other')!.end()
    await flush()
    expect(players.get('shy')!.plays).toBe(1)
    expect(queue.getSnapshot().idle).toBe(true)
  })
}
test('shy is skipped rather than deferred when either lane is occupied', async () => {
  const {queue, push} = setup()
  push('parallel', {priority: 'async'})
  const quiet = push('quiet', {priority: 'shy'})
  expect(await quiet.finished).toEqual({
    status: 'skipped',
    reason: 'busy',
  })
  queue.dispose()
})
test('a new shy request is skipped without interrupting the current shy request', async () => {
  const {queue, players, push} = setup()
  const current = push('current-shy', {priority: 'shy'})
  await flush()
  const skipped = push('new-shy', {priority: 'shy'})
  expect(await skipped.finished).toEqual({
    status: 'skipped',
    reason: 'busy',
  })
  expect(queue.getSnapshot().current?.id).toBe(current.id)
  expect(players.get('current-shy')!.playing).toBe(true)
  players.get('current-shy')!.end()
  await flush()
  const currentResult = await current.finished
  expect(currentResult.status).toBe('completed')
})
test('volatile queues normally behind current work and ahead of later normal work', async () => {
  const {queue, players, push} = setup()
  const first = push('first')
  const volatile = push('volatile', {priority: 'volatile'})
  const later = push('later')
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(first.id)
  expect(queue.getSnapshot().pending.map(job => job.id)).toEqual([volatile.id, later.id])
  players.get('first')!.end()
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(volatile.id)
  expect(players.get('volatile')!.playing).toBe(true)
  players.get('volatile')!.end()
  await flush()
  const volatileResult = await volatile.finished
  expect(volatileResult.status).toBe('completed')
  expect(queue.getSnapshot().current?.id).toBe(later.id)
  queue.dispose()
})
for (const priority of ['normal', 'high', 'inject', 'async', 'destructive', 'volatile'] as const) {
  test(`current volatile yields permanently to ${priority}`, async () => {
    const {queue, players, push} = setup()
    const volatile = push('volatile', {priority: 'volatile'})
    await flush()
    const replacement = push('other', {priority})
    await flush()
    expect(await volatile.finished).toEqual({
      status: 'cancelled',
      reason: priority === 'destructive' ? 'destructive' : 'yielded',
    })
    expect(players.get('volatile')!.disposals).toBe(1)
    expect(players.get('volatile')!.plays).toBe(1)
    players.get('other')!.end()
    await flush()
    const replacementResult = await replacement.finished
    expect(replacementResult.status).toBe('completed')
    expect(players.get('volatile')!.plays).toBe(1)
    queue.dispose()
  })
}
test('pending volatile survives newly queued work until it becomes current', async () => {
  const {queue, players, push} = setup()
  const first = push('first')
  const volatile = push('volatile', {priority: 'volatile'})
  const high = push('high', {priority: 'high'})
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(first.id)
  expect(queue.getSnapshot().pending.map(job => job.id)).toEqual([high.id, volatile.id])
  players.get('first')!.end()
  await flush()
  players.get('high')!.end()
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(volatile.id)
  expect(players.get('volatile')!.playing).toBe(true)
  queue.dispose()
})
test('before/after indicator padding contributes to the minimum audible gap', async () => {
  const {queue, clock, players, push} = setup({
    gap: 1,
    prependedSilence: 0.2,
    appendedSilence: 0.3,
  })
  const a = push('a')
  const b = push('b')
  await flush()
  expect(queue.getSnapshot().current?.phase).toBe('before')
  expect(queue.getSnapshot().current?.phaseEndsAt).toBe(0.2)
  await clock.advance(0.19)
  expect(players.get('a')!.plays).toBe(0)
  await clock.advance(0.01)
  expect(players.get('a')!.plays).toBe(1)
  await clock.advance(0.5)
  players.get('a')!.end()
  await flush()
  expect(queue.getSnapshot().current?.phase).toBe('after')
  expect(queue.getSnapshot().current?.phaseEndsAt).toBe(1)
  await clock.advance(0.29)
  expect(queue.getSnapshot().current?.id).toBe(a.id)
  await clock.advance(0.01)
  const aResult = await a.finished
  expect(aResult.status).toBe('completed')
  expect(queue.getSnapshot().current?.id).toBe(b.id)
  await clock.advance(0.69)
  expect(players.get('b')!.plays).toBe(0)
  await clock.advance(0.01)
  expect(players.get('b')!.plays).toBe(1)
  queue.dispose()
  expect(clock.size).toBe(0)
})
test('injection freezes and restores unconsumed leading silence', async () => {
  const {queue, clock, players, push} = setup({prependedSilence: 1})
  push('a')
  await clock.advance(0.4)
  push('inserted', {
    priority: 'inject',
    prependedSilence: 0,
  })
  await flush()
  await clock.advance(4)
  expect(players.get('a')!.plays).toBe(0)
  players.get('inserted')!.end()
  await flush()
  await clock.advance(0.59)
  expect(players.get('a')!.plays).toBe(0)
  await clock.advance(0.01)
  expect(players.get('a')!.plays).toBe(1)
  queue.dispose()
})
test('injection preserves trailing silence without replaying completed audio', async () => {
  const {queue, clock, players, push} = setup({appendedSilence: 1})
  const a = push('a')
  await flush()
  players.get('a')!.end()
  await clock.advance(0.4)
  push('inserted', {
    priority: 'inject',
    appendedSilence: 0,
  })
  await flush()
  players.get('inserted')!.end()
  await flush()
  await clock.advance(0.6)
  expect(await a.finished).toEqual({status: 'completed'})
  expect(players.get('a')!.plays).toBe(1)
  expect(queue.getSnapshot().idle).toBe(true)
})
test('preparation completing under an injection cannot start the suspended sound', async () => {
  const {queue, players, push} = setup()
  const ready = Promise.withResolvers<FakePlayback>()
  const original = new FakePlayback('original')
  queue.push(() => ready.promise)
  await flush()
  push('injection', {priority: 'inject'})
  await flush()
  ready.resolve(original)
  await flush()
  expect(original.plays).toBe(0)
  players.get('injection')!.end()
  await flush()
  expect(original.plays).toBe(1)
  queue.dispose()
})
test('a cancelled provider result is disposed even when its provider ignored abort', async () => {
  const queue = new AudioQueue
  const ready = Promise.withResolvers<FakePlayback>()
  const playback = new FakePlayback
  const handle = queue.push(() => ready.promise)
  await flush()
  handle.cancel('obsolete')
  expect(await handle.finished).toEqual({
    status: 'cancelled',
    reason: 'obsolete',
  })
  ready.resolve(playback)
  await flush()
  expect(playback.plays).toBe(0)
  expect(playback.disposals).toBe(1)
  expect(queue.getSnapshot().idle).toBe(true)
})
test('an old pending play rejection after injection does not kill resumed audio', async () => {
  const {queue, players, push} = setup()
  const starting = Promise.withResolvers<void>()
  const original = new FakePlayback
  let attempts = 0
  const handle = queue.push(() => ({
    finished: original.finished,
    play: () => (++attempts === 1 ? starting.promise : undefined),
    pause: original.pause,
    dispose: original.dispose,
  }))
  await flush()
  push('injection', {priority: 'inject'})
  await flush()
  starting.reject(new Error('Paused while starting'))
  await flush()
  players.get('injection')!.end()
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(handle.id)
  expect(queue.getSnapshot().current?.phase).toBe('playing')
  expect(attempts).toBe(2)
  queue.dispose()
})
for (const stage of ['prepare', 'start', 'playback'] as const) {
  test(`${stage} failure settles and advances the queue exactly once`, async () => {
    const {queue, push} = setup()
    const bad = new FakePlayback
    const failure = new Error(stage)
    const handle = queue.push(() => {
      if (stage === 'prepare') {
        throw failure
      }
      if (stage === 'start') {
        bad.play = () => {
          throw failure
        }
      }
      return bad
    })
    const next = push('next')
    await flush()
    if (stage === 'playback') {
      bad.completion.reject(failure)
    }
    await flush()
    expect(await handle.finished).toEqual({
      status: 'failed',
      error: failure,
    })
    expect(queue.getSnapshot().current?.id).toBe(next.id)
    expect(bad.disposals).toBe(stage === 'prepare' ? 0 : 1)
    queue.dispose()
  })
}
test('external abort cancels pending and suspended items without cancelling the injection', async () => {
  const {queue, push} = setup()
  const controller = new AbortController
  const a = push('a', {signal: controller.signal})
  const pending = push('pending', {signal: controller.signal})
  await flush()
  const injection = push('injection', {priority: 'inject'})
  await flush()
  controller.abort('owner unmounted')
  await flush()
  const aResult = await a.finished
  expect(aResult.status).toBe('cancelled')
  const pendingResult = await pending.finished
  expect(pendingResult.status).toBe('cancelled')
  expect(queue.getSnapshot().current?.id).toBe(injection.id)
  expect(queue.getSnapshot().interrupted).toHaveLength(0)
  queue.dispose()
})
test('key deduplication, stable snapshots, validation and idempotent disposal', async () => {
  const {queue, push} = setup()
  const initial = queue.getSnapshot()
  expect(queue.getSnapshot()).toBe(initial)
  const first = push('first', {key: 'same'})
  expect(push('duplicate', {key: 'same'})).toBe(first)
  for (const value of [-1, NaN, Infinity]) {
    expect(() => {
      queue.gap = value
    }).toThrow(RangeError)
    expect(() => queue.push(() => new FakePlayback, {appendedSilence: value})).toThrow(RangeError)
  }
  await flush()
  queue.dispose()
  queue.dispose()
  const firstResult = await first.finished
  expect(firstResult.status).toBe('cancelled')
  expect(() => push('late')).toThrow('disposed')
})
test('reentrant subscribers can replace newly prepared jobs without resurrecting them', async () => {
  const {queue, players, push} = setup()
  let replaced = false
  queue.subscribe(() => {
    if (!replaced && queue.getSnapshot().current) {
      replaced = true
      push('replacement', {priority: 'destructive'})
    }
  })
  const original = push('original')
  await flush()
  const originalResult = await original.finished
  expect(originalResult.status).toBe('cancelled')
  expect(players.get('original')!.plays).toBe(0)
  expect(players.get('replacement')!.plays).toBe(1)
  queue.dispose()
})
test('pausing holds the playing sound and every concurrent one where they are, and resuming plays them on', async () => {
  const {queue, players, push} = setup()
  const a = push('a')
  push('later')
  const side = push('side', {priority: 'async'})
  await flush()
  players.get('a')!.position = 2.5
  const running = queue.getSnapshot()
  expect(running.paused).toBe(false)
  queue.pause()
  queue.pause()
  expect(queue.paused).toBe(true)
  expect(queue.getSnapshot()).not.toBe(running)
  expect(queue.getSnapshot().paused).toBe(true)
  expect(queue.getSnapshot().current?.id).toBe(a.id)
  expect(queue.getSnapshot().current?.suspended).toBe(false)
  expect(queue.getSnapshot().interrupted).toHaveLength(0)
  expect(players.get('a')!.pauses).toBe(1)
  expect(players.get('a')!.playing).toBe(false)
  expect(players.get('side')!.pauses).toBe(1)
  await flush()
  expect(players.get('later')).toMatchObject({plays: 0})
  queue.resume()
  queue.resume()
  await flush()
  expect(queue.getSnapshot().paused).toBe(false)
  expect(players.get('a')!.plays).toBe(2)
  expect(players.get('a')!.position).toBe(2.5)
  expect(players.get('a')!.playing).toBe(true)
  expect(players.get('side')!.playing).toBe(true)
  expect(queue.getSnapshot().current?.phase).toBe('playing')
  players.get('a')!.end()
  await flush()
  expect(await a.finished).toEqual({status: 'completed'})
  expect(players.get('later')!.plays).toBe(1)
  players.get('side')!.end()
  await flush()
  expect(await side.finished).toEqual({status: 'completed'})
  queue.dispose()
})
test('a pause freezes leading and trailing silence and does not count toward the gap', async () => {
  const {queue, clock, players, push} = setup({
    gap: 1,
    prependedSilence: 0.5,
    appendedSilence: 0.3,
  })
  const a = push('a')
  push('b')
  await clock.advance(0.2)
  expect(queue.getSnapshot().current?.phaseEndsAt).toBe(0.5)
  queue.pause()
  expect(queue.getSnapshot().current?.phaseEndsAt).toBeUndefined()
  expect(clock.size).toBe(0)
  await clock.advance(10)
  expect(players.get('a')!.plays).toBe(0)
  queue.resume()
  expect(queue.getSnapshot().current?.phaseEndsAt).toBeCloseTo(10.5)
  await clock.advance(0.29)
  expect(players.get('a')!.plays).toBe(0)
  await clock.advance(0.02)
  expect(players.get('a')!.plays).toBe(1)
  players.get('a')!.end()
  await flush()
  // 0.1 s into the trailing silence, which the gap has already begun with
  await clock.advance(0.1)
  queue.pause()
  await clock.advance(5)
  expect(queue.getSnapshot().current?.id).toBe(a.id)
  queue.resume()
  await clock.advance(0.19)
  expect(queue.getSnapshot().current?.id).toBe(a.id)
  await clock.advance(0.02)
  expect(await a.finished).toEqual({status: 'completed'})
  // Of the gap of 1 s, 0.3 s passed before the pause and during the trailing silence, none of it during the pause.
  await clock.advance(0.68)
  expect(players.get('b')!.plays).toBe(0)
  await clock.advance(0.03)
  expect(players.get('b')!.plays).toBe(1)
  queue.dispose()
  expect(clock.size).toBe(0)
})
test('a paused queue still takes, prepares and cancels entries, but nothing sounds before it resumes', async () => {
  const {queue, clock, players, push} = setup({prependedSilence: 0.2})
  queue.pause()
  const a = push('a')
  const b = push('b')
  await flush()
  expect(queue.getSnapshot().current).toMatchObject({
    id: a.id,
    phase: 'before',
  })
  await clock.advance(3)
  expect(players.get('a')!.plays).toBe(0)
  a.cancel('not anymore')
  await flush()
  expect(await a.finished).toEqual({
    status: 'cancelled',
    reason: 'not anymore',
  })
  expect(players.get('a')!.disposals).toBe(1)
  expect(queue.getSnapshot().current?.id).toBe(b.id)
  await clock.advance(3)
  expect(players.get('b')!.plays).toBe(0)
  queue.resume()
  await clock.advance(0.19)
  expect(players.get('b')!.plays).toBe(0)
  await clock.advance(0.02)
  expect(players.get('b')!.plays).toBe(1)
  queue.dispose()
})
test('an injection during a pause takes over silently, and both play in turn once the queue resumes', async () => {
  const {queue, clock, players, push} = setup({gap: 0.5})
  const a = push('a')
  await flush()
  await clock.advance(2)
  players.get('a')!.position = 1.5
  queue.pause()
  await clock.advance(4)
  const injected = push('injected', {priority: 'inject'})
  await flush()
  expect(players.get('a')!.pauses).toBe(1)
  expect(queue.getSnapshot().interrupted.map(job => job.id)).toEqual([a.id])
  expect(queue.getSnapshot().current?.id).toBe(injected.id)
  expect(players.get('injected')!.plays).toBe(0)
  await clock.advance(4)
  queue.resume()
  // The sound it interrupted fell silent when the pause began, so the gap runs from where the queue resumes.
  await clock.advance(0.49)
  expect(players.get('injected')!.plays).toBe(0)
  await clock.advance(0.02)
  expect(players.get('injected')!.plays).toBe(1)
  players.get('injected')!.end()
  await clock.advance(0.49)
  expect(players.get('a')!.plays).toBe(1)
  await clock.advance(0.02)
  expect(players.get('a')!.plays).toBe(2)
  expect(players.get('a')!.position).toBe(1.5)
  queue.dispose()
})
test('pausing between a start and its playback keeps the stale start from sounding', async () => {
  const {queue, players, push} = setup()
  const started = Promise.withResolvers<void>()
  const ended = Promise.withResolvers<void>()
  let plays = 0
  // Its first start only resolves once the test says so, like a media element still buffering.
  const player: AudioPlayback = {
    finished: ended.promise,
    dispose() {},
    pause() {},
    play: () => (++plays === 1 ? started.promise : undefined),
  }
  const handle = queue.push(() => player)
  await flush()
  expect(queue.getSnapshot().current?.phase).toBe('starting')
  queue.pause()
  // A media element rejects the start a pause interrupts.
  started.reject(new Error('interrupted by pause'))
  await flush()
  expect(queue.has(handle.id)).toBe(true)
  expect(queue.getSnapshot().current?.phase).toBe('starting')
  queue.resume()
  await flush()
  expect(plays).toBe(2)
  expect(queue.getSnapshot().current?.phase).toBe('playing')
  // A pause right as a start is due skips it, and resuming starts it again.
  push('next')
  ended.resolve()
  queue.pause()
  await flush()
  expect(players.get('next')!.plays).toBe(0)
  queue.resume()
  await flush()
  expect(players.get('next')!.plays).toBe(1)
  queue.dispose()
})
test('clearing or disposing a paused queue releases everything, and a failing pause fails only its entry', async () => {
  const {queue, players, push} = setup()
  const broken = new FakePlayback('broken')
  broken.pause = () => {
    throw new Error('cannot pause')
  }
  const failing = queue.push(() => broken)
  const next = push('next')
  await flush()
  queue.pause()
  expect(await failing.finished).toMatchObject({status: 'failed'})
  expect(broken.disposals).toBe(1)
  await flush()
  expect(queue.getSnapshot().current?.id).toBe(next.id)
  expect(players.get('next')!.plays).toBe(0)
  queue.clear('stopped')
  expect(await next.finished).toEqual({
    status: 'cancelled',
    reason: 'stopped',
  })
  expect(queue.getSnapshot()).toMatchObject({
    idle: true,
    paused: true,
  })
  queue.dispose()
  queue.resume()
  queue.pause()
  expect(() => push('late')).toThrow('disposed')
})
