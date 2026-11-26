import {afterEach, beforeEach, expect, test} from 'bun:test'

import {renderToStaticMarkup} from 'react-dom/server'

import MenuOptions from '#component/MenuOptions'

import {switchGraphics} from '../../src/lib/gallery/actions.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {graphicsProfile, graphicsQuality, planGraphicsChange, readGraphicsOverride, readRequestedGraphics, readStoredGraphics, toggledGraphicsQuality, useNextGraphics} from '../../src/lib/rendering/graphicsQuality.ts'

const storageKey = 'slop-gallery-graphics'
const descriptors = {
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  location: Object.getOwnPropertyDescriptor(globalThis, 'location'),
}
let values: Map<string, string>
let assigned: Array<string>
const mockLocation = (href: string) => Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: {
    href,
    assign: (url: string) => assigned.push(url),
    reload: () => {
      throw new Error('Switching graphics never reloads the page.')
    },
  },
})
beforeEach(() => {
  values = new Map
  assigned = []
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
})
afterEach(() => {
  useNextGraphics.setState(useNextGraphics.getInitialState(), true)
  useGallery.setState({notice: ''})
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
})
test('a page asks for the graphics of ?graphics, else those the menu stored, else fast', () => {
  expect(readRequestedGraphics('https://slop.gallery/')).toBe('fast')
  values.set(storageKey, 'heavy')
  expect(readStoredGraphics()).toBe('heavy')
  expect(readRequestedGraphics('https://slop.gallery/')).toBe('heavy')
  expect(readRequestedGraphics('https://slop.gallery/?graphics=cinematic')).toBe('cinematic')
  // A ?graphics of no known name still overrides the stored graphics, as fast.
  expect(readGraphicsOverride('https://slop.gallery/?graphics=ultra')).toBe('fast')
  expect(readRequestedGraphics('https://slop.gallery/?graphics=ultra')).toBe('fast')
  expect(readGraphicsOverride('https://slop.gallery/?seed=1')).toBeUndefined()
  values.set(storageKey, 'auto')
  expect(readRequestedGraphics('https://slop.gallery/')).toBe('auto')
  values.set(storageKey, 'garbage')
  expect(readStoredGraphics()).toBeUndefined()
  expect(readRequestedGraphics('https://slop.gallery/')).toBe('fast')
})
test('the menu’s switch goes between fast and heavy, from cinematic to fast', () => {
  expect(toggledGraphicsQuality('fast')).toBe('heavy')
  expect(toggledGraphicsQuality('heavy')).toBe('fast')
  expect(toggledGraphicsQuality('cinematic')).toBe('fast')
})
test('a page with ?graphics goes to the same URL with the other graphics, leaving the stored ones alone', () => {
  expect(planGraphicsChange('heavy', 'https://slop.gallery/?seed=1&graphics=fast&audio#knot')).toEqual({
    via: 'url',
    url: 'https://slop.gallery/?seed=1&graphics=heavy&audio=#knot',
    quality: 'heavy',
  })
  expect(planGraphicsChange('fast', 'https://slop.gallery/?graphics=auto').via).toBe('url')
  expect(planGraphicsChange('heavy', 'https://slop.gallery/?seed=1')).toEqual({
    via: 'storage',
    quality: 'heavy',
  })
  mockLocation('https://slop.gallery/?graphics=fast&seed=3')
  switchGraphics()
  expect(assigned).toEqual(['https://slop.gallery/?graphics=heavy&seed=3'])
  expect(values.size).toBe(0)
  // This page keeps its graphics until it is gone.
  expect(useNextGraphics.getState().quality).toBe(graphicsQuality)
})
test('without ?graphics, the switch only stores the graphics for the next reload and this page keeps its own', () => {
  mockLocation('https://slop.gallery/?seed=3')
  const profile = graphicsProfile
  switchGraphics()
  expect(values.get(storageKey)).toBe('heavy')
  expect(useNextGraphics.getState().quality).toBe('heavy')
  expect(graphicsQuality).toBe('fast')
  expect(graphicsProfile).toBe(profile)
  switchGraphics()
  expect(values.get(storageKey)).toBe('fast')
  expect(useNextGraphics.getState().quality).toBe('fast')
  expect(assigned).toEqual([])
})
test('blocked storage leaves the next page’s graphics as they were and says so', () => {
  mockLocation('https://slop.gallery/')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new DOMException('blocked', 'SecurityError')
    },
  })
  switchGraphics()
  expect(useNextGraphics.getState().quality).toBe('fast')
  expect(useGallery.getState().notice).toContain('storage')
})
test('the menu’s button names the next page’s graphics and tells while they differ from this page’s', () => {
  const html = renderToStaticMarkup(<MenuOptions />)
  expect(html).toContain('aria-pressed="false"')
  expect(html).toContain('<small>Fast</small>')
  expect(html).not.toContain('data-pending')
  expect(html).toContain('Applies from the next reload on.')
  // Server rendering reads the store’s initial state.
  const initial = useNextGraphics.getInitialState()
  Object.assign(initial, {quality: 'heavy'})
  let pending: string
  try {
    pending = renderToStaticMarkup(<MenuOptions />)
  } finally {
    Object.assign(initial, {quality: graphicsQuality})
  }
  expect(pending).toContain('aria-pressed="true"')
  expect(pending).toContain('data-pending="true"')
  expect(pending).toMatch(/<small><svg[^>]*>.*?<\/svg>Heavy<\/small>/u)
  expect(pending).toContain('Reload to switch. This page keeps Fast graphics until then.')
})
