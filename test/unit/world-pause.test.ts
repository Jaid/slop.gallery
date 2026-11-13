import '../../src/lib/frozenTime.ts'

import {afterEach, expect, spyOn, test} from 'bun:test'

import {NodeFrame} from 'three/webgpu'
import PauseMenu from 'use-pause-menu/core'

import {TestDocument, TestTarget} from '../../packages/use-pause-menu/test/browser.ts'
import WorldClock from '../../src/lib/WorldClock.ts'
import worldTime, {freezesWorld} from '../../src/lib/worldTime.ts'

// Restore the singleton timeline exactly so other tests that use performance.now() keep their original epoch.
// eslint-disable-next-line typescript/no-misused-spread -- Save own timing state for test isolation, not a working clock clone.
const initial = {...worldTime}
afterEach(() => Object.assign(worldTime, initial))
test.each(['first', 'return', 'reset', 'pause', 'unfocus'] as const)('only an unlocked Escape pause freezes the world (%s)', stage => {
  expect(freezesWorld({
    stage,
    locked: false,
  })).toBe(stage === 'pause')
  expect(freezesWorld({
    stage,
    locked: true,
  })).toBe(false)
})
test('world time excludes repeated pauses but not running time and publishes only transitions', () => {
  let now = 100
  const time = new WorldClock(() => now)
  const changes: Array<boolean> = []
  const detach = time.subscribe(() => changes.push(time.paused))
  expect(time.now()).toBe(100)
  time.paused = true
  now = 10_100
  time.paused = true
  expect(time.now()).toBe(100)
  time.paused = false
  expect(time.now()).toBe(100)
  now += 50
  expect(time.now()).toBe(150)
  time.paused = true
  now += 900
  time.paused = false
  expect(time.now()).toBe(150)
  expect(changes).toEqual([true, false, true, false])
  detach()
  time.paused = true
  expect(changes).toHaveLength(4)
})
test('the actual menu freezes only Escape, stays frozen through subsequent focus loss and resumes only on lock', async () => {
  const document = new TestDocument
  const menu = new PauseMenu
  const target = new TestTarget(document)
  const detach = menu.attach(target.element)
  const time = new WorldClock
  const unsubscribe = menu.subscribe(() => {
    time.paused = freezesWorld(menu.getSnapshot())
  })
  try {
    document.change(target)
    document.escape()
    document.change(null)
    expect(time.paused).toBe(true)
    document.blur()
    expect(time.paused).toBe(true)
    await menu.enter()
    expect(time.paused).toBe(true)
    document.change(target)
    expect(time.paused).toBe(false)
    document.blur()
    document.change(null)
    expect(menu.getSnapshot().stage).toBe('unfocus')
    expect(time.paused).toBe(false)
  } finally {
    unsubscribe()
    detach()
  }
})
test('shader time resumes from the same point rather than adding time spent in Escape’s menu', () => {
  let now = performance.now()
  const read = spyOn(performance, 'now').mockImplementation(() => now)
  try {
    const frame = new NodeFrame
    frame.update()
    now += 100
    frame.update()
    expect(frame.time).toBeCloseTo(0.1)
    worldTime.paused = true
    now += 30_000
    frame.update()
    expect(frame.time).toBeCloseTo(0.1)
    expect(frame.deltaTime).toBe(0)
    worldTime.paused = false
    now += 16
    frame.update()
    expect(frame.time).toBeCloseTo(0.116)
    expect(frame.deltaTime).toBeCloseTo(0.016)
  } finally {
    read.mockRestore()
  }
})
test('fusion timers cannot finish during a pause and resume on the same timeline', async () => {
  const {default: Fusion} = await import('../../src/lib/gallery/fusion/Fusion.ts')
  const {portalFrame} = await import('../../src/lib/gallery/fusion/portalFrame.ts')
  const {fusionTiming} = await import('../../src/lib/gallery/fusion/timing.ts')
  const work = {
    id: 'pause-test',
    position: [0, 2, 0] as [number, number, number],
    rotation: 0,
    width: 1,
    height: 1,
  }
  let now = performance.now()
  const read = spyOn(performance, 'now').mockImplementation(() => now)
  const fusion = new Fusion({
    work,
    partner: {
      kind: 'item',
      id: 'orb',
    },
    images: [],
    effects: [],
    latches: [],
  }, {
    frame: portalFrame(work, {
      floor: 0,
      room: 8,
      sides: [6, 6],
    }),
    timing: {
      ...fusionTiming,
      intro: 0,
      fizzle: 0.01,
    },
  })
  try {
    let closed = false
    const completion = fusion.fail().then(() => {
      closed = true
    })
    // Pause exactly at the deadline, before the asynchronous timer gets its turn.
    now += 10
    worldTime.paused = true
    now += 60_000
    await Bun.sleep(120)
    expect(fusion.elapsed()).toBeCloseTo(0.01)
    expect(closed).toBe(false)
    expect(fusion.closed).toBe(false)
    worldTime.paused = false
    await completion
    expect(fusion.closed).toBe(true)
    expect(fusion.elapsed()).toBeCloseTo(0.01)
  } finally {
    fusion.abort()
    worldTime.paused = false
    read.mockRestore()
  }
})
