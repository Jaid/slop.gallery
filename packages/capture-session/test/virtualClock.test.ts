import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import {installVirtualClock} from '../src/script/virtualClock.ts'

const fps = 60
/** the wall clock as a film started its virtual one, whose 16.666… ms frames rounded short of a fusion’s deadline */
const filmStart = 25_074.899999976158
const pageGlobals = ['requestAnimationFrame', 'cancelAnimationFrame', 'virtualClock'] as const
/** the clock’s moment after each of `frames` frames */
const run = (frames: number) => Array.from({length: frames}, () => {
  globalThis.virtualClock!.step(1 / fps)
  return performance.now()
})
describe('virtual clock', () => {
  const originalNow = Object.getOwnPropertyDescriptor(performance, 'now')
  const originals = pageGlobals.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
  beforeEach(() => {
    Object.defineProperty(performance, 'now', {
      configurable: true,
      value: () => filmStart,
    })
    globalThis.requestAnimationFrame = () => 0
    installVirtualClock()
    globalThis.virtualClock!.start()
  })
  afterEach(() => {
    if (originalNow) {
      Object.defineProperty(performance, 'now', originalNow)
    } else {
      Reflect.deleteProperty(performance, 'now')
    }
    for (const [index, name] of pageGlobals.entries()) {
      const original = originals[index]
      if (original) {
        Object.defineProperty(globalThis, name, original)
      } else {
        Reflect.deleteProperty(globalThis, name)
      }
    }
  })
  test('meets a deadline that falls exactly on a frame on that frame', () => {
    const moments = run(1000)
    // like a fusion struck on frame 72, which emerges 13.5 s later and spits out what is left of the orb 0.35 s after that
    expect((moments[72 + 810] - moments[72]) / 1000).toBeGreaterThanOrEqual(13.5)
    for (let start = 0; start < 150; start++) {
      for (const frames of [1, 21, 90, 810, 831]) {
        expect((moments[start + frames] - moments[start]) / 1000).toBeGreaterThanOrEqual(frames / fps)
      }
    }
  })
  test('stays within microseconds of the moments asked for and stands still for a step of 0', () => {
    const moments = run(3000)
    expect(Math.abs(moments.at(-1)! - filmStart - 3000 * 1000 / fps)).toBeLessThan(0.01)
    globalThis.virtualClock!.step(0)
    expect(performance.now()).toBe(moments.at(-1)!)
  })
})
