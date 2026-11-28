import {afterEach, beforeEach, expect, jest, test} from 'bun:test'

import withMinimumTime from '../../src/lib/ai/minimumTime.ts'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})
test('releases a cached answer at the deadline and a slower one as soon as it arrives', async () => {
  const slow = Promise.withResolvers<string>()
  const later = withMinimumTime(slow.promise, 1)
  const cached = withMinimumTime(Promise.resolve('cached'), 1)
  jest.advanceTimersByTime(1000)
  expect(await cached).toBe('cached')
  expect(Bun.peek.status(later)).toBe('pending')
  slow.resolve('slow')
  expect(await later).toBe('slow')
})
test('an abort just before the deadline still cancels a cached answer', async () => {
  const controller = new AbortController
  const waiting = withMinimumTime(Promise.resolve('cached'), 1, controller.signal)
  jest.advanceTimersByTime(999)
  controller.abort()
  await expect(waiting).rejects.toThrow()
  expect(jest.getTimerCount()).toBe(0)
})
test('zero delay and failed requests settle without advancing the clock or leaving timers behind', async () => {
  expect(await withMinimumTime(Promise.resolve('ready'), 0)).toBe('ready')
  const error = new Error('busy')
  await expect(withMinimumTime(Promise.reject(error), 10)).rejects.toBe(error)
  expect(jest.getTimerCount()).toBe(0)
})
