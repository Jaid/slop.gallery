import {afterEach, beforeEach, describe, expect, mock, spyOn, test} from 'bun:test'

import PauseMenu from 'use-pause-menu/core'

import {TestTarget} from '../../packages/use-pause-menu/test/browser.ts'
import freezeWhilePaused from '../../src/lib/gallery/worldPause.ts'
import {isPausing} from '../../src/lib/pauseMenu.ts'
import {WorldClock} from '../../src/lib/worldClock.ts'

let wall = 0
let performanceNow: ReturnType<typeof spyOn<Performance, 'now'>>
beforeEach(() => {
  wall = 1000
  performanceNow = spyOn(performance, 'now').mockImplementation(() => wall)
})
afterEach(() => {
  performanceNow.mockRestore()
})
describe('the clock of the world', () => {
  test('follows the wall clock, stands still while frozen and goes on right where it stood', () => {
    const clock = new WorldClock
    expect(clock.frozen).toBe(false)
    expect(clock.now()).toBe(1000)
    wall = 1500
    expect(clock.now()).toBe(1500)
    const release = clock.freeze()
    expect(clock.frozen).toBe(true)
    expect(clock.getSnapshot()).toBe(true)
    wall = 9500
    expect(clock.now()).toBe(1500)
    release()
    expect(clock.frozen).toBe(false)
    expect(clock.now()).toBe(1500)
    wall = 9750
    expect(clock.now()).toBe(1750)
    // A second freeze adds to the time lost.
    const again = clock.freeze()
    wall = 10_000
    again()
    wall = 10_100
    expect(clock.now()).toBe(1850)
  })
  test('stays frozen until everyone holding it let go, and a release only counts once', () => {
    const clock = new WorldClock
    const listener = mock(() => {})
    clock.subscribe(listener)
    const first = clock.freeze()
    wall = 2000
    const second = clock.freeze()
    expect(listener).toHaveBeenCalledTimes(1)
    wall = 3000
    first()
    first()
    expect(clock.frozen).toBe(true)
    expect(clock.now()).toBe(1000)
    expect(listener).toHaveBeenCalledTimes(1)
    wall = 4000
    second()
    expect(clock.frozen).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(clock.now()).toBe(1000)
    wall = 4250
    expect(clock.now()).toBe(1250)
  })
  test('tells its listeners with the new state already in effect, and lets them leave while it does', () => {
    const clock = new WorldClock
    const seen: Array<[frozen: boolean, now: number]> = []
    const unsubscribe = clock.subscribe(() => {
      seen.push([clock.frozen, clock.now()])
    })
    const leaving: {leave?: () => void} = {}
    const once = mock(() => {
      leaving.leave!()
    })
    leaving.leave = clock.subscribe(once)
    wall = 1200
    const release = clock.freeze()
    wall = 5200
    release()
    expect(seen).toEqual([[true, 1200], [false, 1200]])
    expect(once).toHaveBeenCalledTimes(1)
    unsubscribe()
    clock.freeze()
    expect(seen).toHaveLength(2)
  })
  test('a listener that fails keeps nobody else from following the clock', () => {
    const clock = new WorldClock
    const reported = spyOn(globalThis, 'reportError').mockImplementation(() => {})
    try {
      const failure = new Error('no audio device')
      clock.subscribe(() => {
        throw failure
      })
      const listener = mock(() => {})
      clock.subscribe(listener)
      const release = clock.freeze()
      expect(clock.frozen).toBe(true)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(reported).toHaveBeenLastCalledWith(failure)
      release()
      expect(listener).toHaveBeenCalledTimes(2)
      expect(reported).toHaveBeenCalledTimes(2)
    } finally {
      reported.mockRestore()
    }
  })
})
/** a world that has loaded, until told otherwise */
function loaded() {
  const listeners = new Set<() => void>
  const state = {ready: true}
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(ready: boolean) {
      state.ready = ready
      for (const listener of listeners) {
        listener()
      }
    },
  }
}
/** a menu on a canvas double, with a world that has loaded and a clock of its own, which follows both */
function setup() {
  const menu = new PauseMenu({initialStage: 'return'})
  const target = new TestTarget
  menu.attach(target.element)
  const clock = new WorldClock
  const gallery = loaded()
  return {
    menu,
    target,
    document: target.ownerDocument,
    clock,
    gallery,
    stop: freezeWhilePaused(menu, clock, gallery),
  }
}
describe('the pause menu freezing the world', () => {
  test('only the menu of the Escape key counts as pausing, and only while it is up', () => {
    for (const stage of ['first', 'return', 'reset', 'unfocus'] as const) {
      expect(isPausing({
        stage,
        locked: false,
      })).toBe(false)
    }
    expect(isPausing({
      stage: 'pause',
      locked: false,
    })).toBe(true)
    // The stage stays the last menu’s while playing.
    expect(isPausing({
      stage: 'pause',
      locked: true,
    })).toBe(false)
  })
  test('Escape freezes the world until the player resumes', () => {
    const {clock, document, target} = setup()
    expect(clock.frozen).toBe(false)
    document.change(target)
    expect(clock.frozen).toBe(false)
    document.escape()
    document.change(null)
    expect(clock.frozen).toBe(true)
    wall = 61_000
    expect(clock.now()).toBe(1000)
    document.change(target)
    expect(clock.frozen).toBe(false)
    expect(clock.now()).toBe(1000)
  })
  test('the Windows key, another tab and a hidden page leave the world running', () => {
    for (const leave of ['blur', 'hide'] as const) {
      const {clock, document, target, menu} = setup()
      document.change(target)
      document[leave]()
      document.change(null)
      expect(menu.getSnapshot()).toEqual({
        stage: 'unfocus',
        locked: false,
      })
      expect(clock.frozen).toBe(false)
      wall += 5000
      expect(clock.now()).toBe(wall)
    }
  })
  test('the menus before the game leave the world running, and a pause follows whichever way the player left last', () => {
    const {clock, document, target, menu} = setup()
    expect(menu.getSnapshot().stage).toBe('return')
    expect(clock.frozen).toBe(false)
    document.change(target)
    document.escape()
    document.change(null)
    expect(clock.frozen).toBe(true)
    // Losing the focus while the pause menu is up changes nothing about it.
    document.blur()
    expect(menu.getSnapshot().stage).toBe('pause')
    expect(clock.frozen).toBe(true)
    document.focused = true
    document.change(target)
    expect(clock.frozen).toBe(false)
    document.blur()
    document.change(null)
    expect(clock.frozen).toBe(false)
  })
  test('following a menu that is already pausing freezes at once, and no longer following it lets the world go on', () => {
    const menu = new PauseMenu
    const target = new TestTarget
    menu.attach(target.element)
    target.ownerDocument.change(target)
    target.ownerDocument.escape()
    target.ownerDocument.change(null)
    const clock = new WorldClock
    const stop = freezeWhilePaused(menu, clock, loaded())
    expect(clock.frozen).toBe(true)
    stop()
    stop()
    expect(clock.frozen).toBe(false)
    target.ownerDocument.change(target)
    target.ownerDocument.escape()
    target.ownerDocument.change(null)
    expect(clock.frozen).toBe(false)
  })
  test('a world that isn’t ready runs behind the pause menu until it is, as it only loads by drawing frames', () => {
    const {clock, document, gallery, target} = setup()
    document.change(target)
    document.escape()
    document.change(null)
    expect(clock.frozen).toBe(true)
    // The scene mounts anew, like after a hot update.
    gallery.set(false)
    expect(clock.frozen).toBe(false)
    gallery.set(true)
    expect(clock.frozen).toBe(true)
    document.change(target)
    expect(clock.frozen).toBe(false)
    gallery.set(false)
    gallery.set(true)
    expect(clock.frozen).toBe(false)
  })
})
