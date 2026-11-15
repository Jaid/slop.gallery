import type {PauseMenuSnapshot} from 'use-pause-menu/core'

import {afterEach, beforeEach, expect, spyOn, test} from 'bun:test'

import {handleGalleryKey, pauseGallery} from '../../src/lib/gallery/actions.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import pauseMenu from '../../src/lib/pauseMenu.ts'

const initial = useGallery.getState()
const previousHTMLElement = globalThis.HTMLElement
class ElementDouble extends EventTarget {
  isContentEditable = false
  closest(selector: string) {
    return selector === 'input, textarea, select' ? this : null
  }
}
const press = (patch: Partial<KeyboardEvent> = {}) => handleGalleryKey({
  altKey: false,
  code: 'Escape',
  ctrlKey: false,
  defaultPrevented: false,
  metaKey: false,
  preventDefault() {},
  repeat: false,
  target: null,
  ...patch,
} as unknown as KeyboardEvent)
/** How often bringing the pause menu up reaches the menu in the snapshot, in a world that is ready unless told otherwise. */
function pausesFor(snapshot: PauseMenuSnapshot, ready = true) {
  useGallery.setState({ready})
  const getSnapshot = spyOn(pauseMenu, 'getSnapshot').mockReturnValue(snapshot)
  const pause = spyOn(pauseMenu, 'pause').mockImplementation(() => {})
  try {
    pauseGallery()
    return pause.mock.calls.length
  } finally {
    pause.mockRestore()
    getSnapshot.mockRestore()
  }
}
beforeEach(() => {
  Object.assign(globalThis, {HTMLElement: ElementDouble})
})
afterEach(() => {
  useGallery.setState(initial, true)
  Object.assign(globalThis, {HTMLElement: previousHTMLElement})
})
test.each(['first', 'return', 'reset'] as const)('the %s menu before the game jumps straight to the pause menu', stage => {
  expect(pausesFor({
    locked: false,
    stage,
  })).toBe(1)
})
test('a world that is still loading, a game in play and the menus of a game already left stay as they are', () => {
  expect(pausesFor({
    locked: false,
    stage: 'first',
  }, false)).toBe(0)
  for (const snapshot of [
    {
      locked: true,
      stage: 'first',
    },
    {
      locked: false,
      stage: 'pause',
    },
    {
      locked: false,
      stage: 'unfocus',
    },
  ] as const satisfies ReadonlyArray<PauseMenuSnapshot>) {
    expect(pausesFor(snapshot)).toBe(0)
  }
})
test('Escape reaches the pause menu through the gallery’s keys once, without modifiers, repeats or text fields taking it there', () => {
  useGallery.setState({ready: true})
  const getSnapshot = spyOn(pauseMenu, 'getSnapshot').mockReturnValue({
    locked: false,
    stage: 'first',
  })
  const pause = spyOn(pauseMenu, 'pause').mockImplementation(() => {})
  try {
    press()
    press({repeat: true})
    press({ctrlKey: true})
    press({defaultPrevented: true})
    press({target: new ElementDouble})
    expect(pause).toHaveBeenCalledTimes(1)
  } finally {
    pause.mockRestore()
    getSnapshot.mockRestore()
  }
})
