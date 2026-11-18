import {afterEach, expect, test} from 'bun:test'

import {graphicsQualities, initialGraphicsQuality, supportsGraphicsQuality, toggledGraphicsQuality, useGraphicsQuality} from '../../src/lib/rendering/graphicsQuality.ts'
import setGraphicsQuality from '../../src/lib/webmcp/setGraphicsQuality.ts'

afterEach(() => useGraphicsQuality.setState({quality: initialGraphicsQuality}))
test('a page without ?graphics starts with fast graphics', () => {
  expect(initialGraphicsQuality).toBe('fast')
  expect(useGraphicsQuality.getState().quality).toBe('fast')
  expect(graphicsQualities).toEqual(['fast', 'heavy', 'cinematic'])
})
test('the set_graphics_quality tool’s switch takes any graphics the page can show by name and null for the initial ones', () => {
  expect(setGraphicsQuality({quality: 'heavy'})).toEqual({
    quality: 'heavy',
    previous: 'fast',
    initial: 'fast',
  })
  expect(useGraphicsQuality.getState().quality).toBe('heavy')
  expect(setGraphicsQuality({quality: 'heavy'}).previous).toBe('heavy')
  expect(setGraphicsQuality({quality: null})).toEqual({
    quality: 'fast',
    previous: 'heavy',
    initial: 'fast',
  })
  expect(useGraphicsQuality.getState().quality).toBe('fast')
  setGraphicsQuality({quality: 'heavy'})
  expect(() => setGraphicsQuality({quality: 'ultra'})).toThrow(/fast, heavy, cinematic/)
  expect(() => setGraphicsQuality({quality: 'auto'})).toThrow(/no “auto” graphics/)
  // This page’s renderer never asked for what cinematic graphics need.
  expect(() => setGraphicsQuality({quality: 'cinematic'})).toThrow(/\?graphics=cinematic/)
  expect(useGraphicsQuality.getState().quality).toBe('heavy')
})
test('cinematic graphics need a page that started with them, which the menu’s heavy then means', () => {
  for (const quality of graphicsQualities) {
    expect(supportsGraphicsQuality(quality, 'cinematic')).toBe(true)
    for (const initial of ['fast', 'heavy'] as const) {
      expect(supportsGraphicsQuality(quality, initial)).toBe(quality !== 'cinematic')
    }
  }
  expect(toggledGraphicsQuality(true, 'cinematic')).toBe('cinematic')
  expect(toggledGraphicsQuality(false, 'cinematic')).toBe('fast')
  expect(toggledGraphicsQuality(true, 'fast')).toBe('heavy')
  expect(toggledGraphicsQuality(true, 'heavy')).toBe('heavy')
  expect(toggledGraphicsQuality(false, 'heavy')).toBe('fast')
})
