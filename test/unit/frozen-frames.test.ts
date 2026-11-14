import {expect, mock, test} from 'bun:test'

import FrozenFrames, {patience, settling} from '../../src/lib/rendering/FrozenFrames.ts'
import {WorldClock} from '../../src/lib/worldClock.ts'

/** A canvas double: its frames come 16 ms apart, only while asked for. */
function setup({busy = false} = {}) {
  const clock = new WorldClock
  const state = {
    busy,
    now: 0,
    running: undefined as boolean | undefined,
  }
  let requested: (() => void) | undefined
  let handle = 0
  const draw = mock(() => {})
  const run = mock((running: boolean) => {
    state.running = running
  })
  const frames = new FrozenFrames({
    busy: () => state.busy,
    clock,
    draw,
    run,
    now: () => state.now,
    requestFrame: callback => {
      requested = callback
      return ++handle
    },
    cancelFrame: canceled => {
      if (canceled === handle) {
        requested = undefined
      }
    },
  })
  /** Lets the browser paint for `ms`, returning how many frames of the frozen world were drawn meanwhile. */
  const paint = (ms: number) => {
    const before = draw.mock.calls.length
    for (const until = state.now + ms; state.now < until;) {
      state.now += 16
      const callback = requested
      requested = undefined
      callback?.()
    }
    return draw.mock.calls.length - before
  }
  return {
    clock,
    draw,
    frames,
    paint,
    run,
    state,
  }
}
test('the world’s frames stop as its clock freezes and run again as it goes on', () => {
  const {clock, draw, frames, paint, run, state} = setup()
  const disconnect = frames.connect()
  // A running world is left as it is.
  expect(run).not.toHaveBeenCalled()
  const release = clock.freeze()
  expect(state.running).toBe(false)
  expect(frames.drawing).toBe(false)
  expect(paint(5000)).toBe(0)
  release()
  expect(state.running).toBe(true)
  expect(draw).not.toHaveBeenCalled()
  // No longer following the clock lets the frames run, whatever the clock says.
  clock.freeze()
  expect(state.running).toBe(false)
  disconnect()
  expect(state.running).toBe(true)
  expect(run.mock.calls).toEqual([[false], [true], [false], [true]])
  // Following a clock that is frozen already stops the frames at once.
  const late = setup()
  late.clock.freeze()
  late.frames.connect()
  expect(late.state.running).toBe(false)
})
test('a frozen world is drawn again once something changed how it shows, until that has settled', () => {
  const {clock, frames, paint} = setup()
  frames.connect()
  // The running world draws itself.
  frames.refresh()
  expect(frames.drawing).toBe(false)
  expect(paint(100)).toBe(0)
  clock.freeze()
  frames.refresh()
  expect(frames.drawing).toBe(true)
  const drawn = paint(settling * 2)
  expect(drawn).toBeGreaterThanOrEqual(Math.floor(settling / 16) - 1)
  expect(drawn).toBeLessThanOrEqual(Math.ceil(settling / 16))
  expect(frames.drawing).toBe(false)
  expect(paint(1000)).toBe(0)
  // Another change before the last one settled only keeps it drawing for as long again.
  frames.refresh()
  paint(settling / 2)
  frames.refresh()
  expect(paint(settling - 32)).toBeGreaterThan(0)
  expect(frames.drawing).toBe(true)
  paint(64)
  expect(frames.drawing).toBe(false)
})
test('a change is drawn at least once, however late the browser paints next, like in a tab that was hidden meanwhile', () => {
  const {clock, draw, frames, paint, state} = setup()
  frames.connect()
  clock.freeze()
  // The window is resized behind another tab, which paints nothing until it shows again.
  frames.refresh()
  state.now += 60_000
  expect(draw).not.toHaveBeenCalled()
  expect(paint(16)).toBe(1)
  expect(paint(1000)).toBe(0)
  expect(frames.drawing).toBe(false)
})
test('what is still underway as the world freezes finishes behind the menu, but not for longer than its patience lasts', () => {
  const {clock, frames, paint, state} = setup({busy: true})
  frames.connect()
  clock.freeze()
  expect(frames.drawing).toBe(true)
  expect(paint(3000)).toBeGreaterThan(150)
  state.busy = false
  paint(32)
  expect(frames.drawing).toBe(false)
  // Something that never finishes gives up.
  state.busy = true
  frames.refresh()
  paint(patience - 100)
  expect(frames.drawing).toBe(true)
  paint(200)
  expect(frames.drawing).toBe(false)
  expect(paint(1000)).toBe(0)
})
test('a frame that asks to be drawn again keeps a single run of frames going, and the world going on ends it', () => {
  const {clock, draw, frames, paint} = setup()
  frames.connect()
  const release = clock.freeze()
  let asking = true
  draw.mockImplementation(() => {
    if (asking) {
      frames.refresh()
    }
  })
  frames.refresh()
  // One frame per paint, not one more for each time it was asked.
  expect(paint(160)).toBe(10)
  expect(paint(settling * 3)).toBe(Math.ceil(settling * 3 / 16))
  asking = false
  expect(paint(settling * 2)).toBeLessThanOrEqual(Math.ceil(settling / 16))
  frames.refresh()
  paint(32)
  expect(frames.drawing).toBe(true)
  release()
  expect(frames.drawing).toBe(false)
  const drawn = draw.mock.calls.length
  paint(1000)
  expect(draw).toHaveBeenCalledTimes(drawn)
  // Before it follows a clock, and after it stopped, nothing asks it for frames.
  const idle = setup()
  idle.clock.freeze()
  idle.frames.refresh()
  expect(idle.frames.drawing).toBe(false)
})
