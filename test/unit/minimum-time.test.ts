import {expect, test} from 'bun:test'

import withMinimumTime from '../../src/lib/ai/minimumTime.ts'

test('an answer that comes back early is held back until the minimum time has passed', async () => {
  const start = performance.now()
  expect(await withMinimumTime(Promise.resolve('cached'), 0.1)).toBe('cached')
  expect(performance.now() - start).toBeGreaterThanOrEqual(95)
})
test('an answer that takes longer than the minimum time is not held back any further', async () => {
  const start = performance.now()
  const slow = new Promise<string>(resolve => setTimeout(() => resolve('slow'), 100))
  expect(await withMinimumTime(slow, 0.05)).toBe('slow')
  expect(performance.now() - start).toBeLessThan(140)
})
test('without a minimum time, the answer comes through as it is', async () => {
  const start = performance.now()
  expect(await withMinimumTime(Promise.resolve('at once'), 0)).toBe('at once')
  expect(performance.now() - start).toBeLessThan(20)
})
test('a failure comes through at once', async () => {
  const start = performance.now()
  await expect(withMinimumTime(Promise.reject(new Error('busy')), 10)).rejects.toThrow('busy')
  expect(performance.now() - start).toBeLessThan(50)
})
test('an abort ends the wait', async () => {
  const controller = new AbortController
  const start = performance.now()
  const waiting = withMinimumTime(Promise.resolve('cached'), 10, controller.signal)
  controller.abort()
  await expect(waiting).rejects.toThrow()
  expect(performance.now() - start).toBeLessThan(50)
})
