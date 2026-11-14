import type {AiSettings} from '../../src/lib/ai/settings.ts'
import type {PauseMenuStage as MenuStage} from 'use-pause-menu/core'

import {afterEach, beforeAll, beforeEach, describe, expect, spyOn, test} from 'bun:test'

import {createElement, Suspense} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {GraphicsModeProvider} from 'use-graphics-mode'

import Menu from '#component/Menu'

import {readAiSettings} from '../../src/lib/ai/settings.ts'
import {setApiKey, toggleSound} from '../../src/lib/gallery/actions.ts'
import {useIntro} from '../../src/lib/gallery/intro.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {startNewGame} from '../../src/lib/gameSeed.ts'
import pauseMenu from '../../src/lib/pauseMenu.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const state = useGallery.getState()
const {orbit} = useIntro.getInitialState()
beforeAll(async () => {
  // The world’s minimap loads lazily: rendering it once starts the download, so the pause stage below renders it in place.
  renderToStaticMarkup(createElement(Suspense, null, createElement(slopGallery.Minimap, {lower: false})))
  await import('#component/GalleryMinimap')
})
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let values: Map<string, string>
beforeEach(() => {
  values = new Map
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  useGallery.setState(useGallery.getInitialState(), true)
  // The menus after the intro, unless a test brings it back. Server rendering reads the stores’ initial states.
  Object.assign(useIntro.getInitialState(), {orbit: null})
})
afterEach(() => {
  useGallery.setState(state, true)
  Object.assign(useIntro.getInitialState(), {orbit})
  if (storageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
describe('minimal menu', () => {
  test('starts unlocked, with an expanded OpenRouter section', () => {
    expect(useGallery.getState().locked).toBe(false)
    const params: AiSettings = readAiSettings()
    const html = renderToStaticMarkup(createElement(GraphicsModeProvider, {
      isHeavy: true,
      onChange: () => {},
      children: createElement(Menu, {
        available: true,
        params,
        setParams: () => {},
      }),
    }))
    expect(html).toContain('aria-labelledby="menu-title"')
    expect(html).toContain('Mute audio')
    expect(html).toContain('Heavy graphics')
    expect(html).toContain('<small>Heavy</small>')
    // The Graphics button names its tooltip, which asks the GPU only once it opens.
    const tooltipId = /aria-label="Heavy graphics"[^>]*\binterestfor="([^"]+)"/u.exec(html)?.[1]
    expect(tooltipId).toBeString()
    expect(html).toMatch(new RegExp(String.raw`<div id="${tooltipId}"[^>]*\bpopover="hint"`, 'u'))
    expect(html).toContain('Auto graphics')
    expect(html).not.toContain('GPU family')
    expect(html).toContain('OpenRouter')
    expect(html).toContain('aria-labelledby="openrouter-title"')
    expect(html).not.toContain('<summary>OpenRouter')
  })
  test('only the OpenRouter key and switched audio reach storage from the store', () => {
    toggleSound()
    expect(useGallery.getState().sound).toBe(true)
    expect(values.get('slop-gallery-audio')).toBe('true')
    toggleSound()
    expect(values.get('slop-gallery-audio')).toBe('false')
    setApiKey('sk-or-test')
    expect(values.get('slop-gallery-key')).toBe('sk-or-test')
    setApiKey('')
    expect(values.has('slop-gallery-key')).toBe(false)
    expect(values.keys().toArray()).toEqual(['slop-gallery-audio'])
  })
})
function primaryActionLabel(stage: MenuStage) {
  if (stage === 'reset') {
    return 'Reroll seed'
  }
  if (stage === 'first') {
    return 'Enter gallery'
  }
  if (stage === 'return') {
    return 'Continue'
  }
  return 'Resume'
}
test.each(['first', 'reset', 'return', 'pause', 'unfocus'] as const)('renders the %s menu stage', (stage: MenuStage) => {
  const initial = {...useGallery.getInitialState()}
  const snapshot = spyOn(pauseMenu, 'getServerSnapshot').mockReturnValue({
    stage,
    locked: false,
  })
  Object.assign(useGallery.getInitialState(), {ready: true})
  try {
    const params: AiSettings = readAiSettings()
    const html = renderToStaticMarkup(createElement(GraphicsModeProvider, {
      isHeavy: true,
      onChange: () => {},
      children: createElement(Menu, {
        available: true,
        params,
        setParams: () => {},
      }),
    }))
    expect(html).toContain(`data-stage="${stage}"`)
    expect(html).toContain(primaryActionLabel(stage))
    expect(html.includes('data-testid="minimap"')).toBe(stage === 'pause')
    expect(html.includes('Reroll seed')).toBe(stage === 'return' || stage === 'reset')
    expect(html.includes('Your position')).toBe(stage === 'pause')
    if (stage === 'pause') {
      expect(html.match(/data-testid="minimap"/gu)).toHaveLength(1)
      expect(html).toContain('data-testid="portrait-collection"')
      expect(html).toMatch(/aria-label="(Upper|Lower) gallery map"/)
    }
    expect(html.includes('OpenRouter')).toBe(stage !== 'unfocus')
    expect(html.includes('Mute audio')).toBe(stage !== 'unfocus')
    expect(html.includes('Good taste.')).toBe(['first', 'reset', 'return'].includes(stage))
    if (stage === 'unfocus') {
      expect(html.match(/<button\b/gu)).toHaveLength(1)
      expect(html).not.toContain('<input')
    }
  } finally {
    snapshot.mockRestore()
    Object.assign(useGallery.getInitialState(), initial)
  }
})
test('Reroll seed forgets the stored seed and reloads', () => {
  const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location')
  let reloads = 0
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      reload: () => {
        reloads++
      },
    },
  })
  try {
    values.set('knot-gallery-seed', '7')
    values.set('slop-gallery-seed', '7')
    startNewGame()
    expect(values.has('slop-gallery-seed')).toBe(false)
    expect(values.get('knot-gallery-seed')).toBe('7')
    expect(reloads).toBe(1)
  } finally {
    if (locationDescriptor) {
      Object.defineProperty(globalThis, 'location', locationDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'location')
    }
  }
})
test.each(['lobby', 'oculus'] as const)('pause heading identifies the %s room and floor', room => {
  const initial = {...useGallery.getInitialState()}
  const snapshot = spyOn(pauseMenu, 'getServerSnapshot').mockReturnValue({
    stage: 'pause',
    locked: false,
  })
  Object.assign(useGallery.getInitialState(), {room})
  try {
    const params: AiSettings = readAiSettings()
    const html = renderToStaticMarkup(createElement(GraphicsModeProvider, {
      isHeavy: true,
      onChange: () => {},
      children: createElement(Menu, {
        available: true,
        params,
        setParams: () => {},
      }),
    }))
    expect(html).toContain(room === 'lobby' ? '>Lobby</h1>' : '>Oculus</h1>')
    expect(html).toContain(room === 'lobby' ? '>upper floor room</p>' : '>lower floor room</p>')
    expect(html).not.toContain('>Slop Gallery</h1>')
    expect(html).not.toContain('Good taste.')
  } finally {
    snapshot.mockRestore()
    Object.assign(useGallery.getInitialState(), initial)
  }
})
test.each(['first', 'return'] as const)('the %s menu stage leaves the intro in view with only the title, Play, audio and graphics', stage => {
  const initial = {...useGallery.getInitialState()}
  const snapshot = spyOn(pauseMenu, 'getServerSnapshot').mockReturnValue({
    stage,
    locked: false,
  })
  Object.assign(useGallery.getInitialState(), {ready: true})
  Object.assign(useIntro.getInitialState(), {orbit: slopGallery.introOrbit})
  try {
    const html = renderToStaticMarkup(createElement(GraphicsModeProvider, {
      isHeavy: true,
      onChange: () => {},
      children: createElement(Menu, {
        available: true,
        params: readAiSettings(),
        setParams: () => {},
      }),
    }))
    expect(html).toContain('>Slop Gallery</h1>')
    expect(html.indexOf('<img')).toBeGreaterThan(-1)
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('id="menu-title"'))
    expect(html).toMatch(/id="enter-gallery"[^>]*>Play</u)
    expect(html).toContain('Mute audio')
    expect(html).toContain('Heavy graphics')
    expect(html.includes('Reroll seed')).toBe(stage === 'return')
    expect(html).not.toContain('OpenRouter')
    expect(html).not.toContain('Good taste.')
    expect(html).not.toContain('data-testid="minimap"')
    // The title, then Play above the settings.
    expect(html.indexOf('id="menu-title"')).toBeLessThan(html.indexOf('id="enter-gallery"'))
    expect(html.indexOf('id="enter-gallery"')).toBeLessThan(html.indexOf('Mute audio'))
  } finally {
    snapshot.mockRestore()
    Object.assign(useGallery.getInitialState(), initial)
    Object.assign(useIntro.getInitialState(), {orbit: null})
  }
})
test('the pause menu after the intro keeps the OpenRouter section', () => {
  const snapshot = spyOn(pauseMenu, 'getServerSnapshot').mockReturnValue({
    stage: 'pause',
    locked: false,
  })
  Object.assign(useIntro.getInitialState(), {orbit: slopGallery.introOrbit})
  try {
    const html = renderToStaticMarkup(createElement(GraphicsModeProvider, {
      isHeavy: true,
      onChange: () => {},
      children: createElement(Menu, {
        available: true,
        params: readAiSettings(),
        setParams: () => {},
      }),
    }))
    expect(html).toContain('OpenRouter')
    expect(html).not.toMatch(/id="enter-gallery"[^>]*>Play</u)
  } finally {
    snapshot.mockRestore()
    Object.assign(useIntro.getInitialState(), {orbit: null})
  }
})
