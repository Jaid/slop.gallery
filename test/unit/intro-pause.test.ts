import type {PauseMenuSnapshot} from 'use-pause-menu/core'

import {afterEach, beforeEach, expect, spyOn, test} from 'bun:test'

import SoundEngine from '../../src/lib/audio/SoundEngine.ts'
import {enterGallery, handleGalleryKey, pauseGallery} from '../../src/lib/gallery/actions.ts'
import {useIntro} from '../../src/lib/gallery/intro.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import pauseMenu from '../../src/lib/pauseMenu.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const initial = useGallery.getState()
const intro = useIntro.getState()
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
/** What resuming asks of the menu, with or without the intro still circling, in a world that is ready unless told otherwise: whether it took a pause back, and how often it entered the game. */
function resumes({circling, paused, ready = true}: {
  circling: boolean
  paused: boolean
  ready?: boolean
}) {
  useGallery.setState({ready})
  useIntro.setState({orbit: circling ? slopGallery.introOrbit : null})
  const unpause = spyOn(pauseMenu, 'unpause').mockReturnValue(paused)
  const enter = spyOn(pauseMenu, 'enter').mockResolvedValue()
  const sound = spyOn(SoundEngine, 'get').mockReturnValue({resume: async () => {}} as unknown as SoundEngine)
  try {
    enterGallery()
    return {
      unpaused: unpause.mock.calls.length,
      entered: enter.mock.calls.length,
    }
  } finally {
    sound.mockRestore()
    enter.mockRestore()
    unpause.mockRestore()
  }
}
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
  useIntro.setState(intro, true)
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
test('resuming the pause menu over the intro gives the intro’s menu back instead of entering the game', () => {
  expect(resumes({
    circling: true,
    paused: true,
  })).toEqual({
    unpaused: 1,
    entered: 0,
  })
})
test('Play from the intro’s menu, a pause without an intro behind it and a pause after the intro enter the game', () => {
  // The menu has no pause to take back.
  expect(resumes({
    circling: true,
    paused: false,
  })).toEqual({
    unpaused: 1,
    entered: 1,
  })
  // Without an intro, like under ?room, the menu before the game isn’t worth going back to.
  expect(resumes({
    circling: false,
    paused: true,
  })).toEqual({
    unpaused: 0,
    entered: 1,
  })
  expect(resumes({
    circling: true,
    paused: true,
    ready: false,
  })).toEqual({
    unpaused: 0,
    entered: 0,
  })
})
