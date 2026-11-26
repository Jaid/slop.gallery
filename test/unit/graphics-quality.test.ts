import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import {graphicsProfile, graphicsQualities, graphicsQuality, isHeavyGraphics, parseGraphicsModeName, planGraphicsPreferenceChange, readGraphicsModeOverride, readNextGraphicsQuality, resolveGraphicsModeName, toggledGraphicsQuality, toggleGraphicsPreference} from '../../src/lib/rendering/graphicsMode.ts'

const encoder = new TextEncoder
const pack = (state: Record<string, unknown>) => encoder.encode(JSON.stringify(state)).toBase64({
  alphabet: 'base64url',
  omitPadding: true,
})
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location')
let values: Map<string, string>
let assigned: Array<string>
let reloads: number
const mockLocation = (href: string) => {
  assigned = []
  reloads = 0
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      href,
      assign: (url: URL | string) => {
        assigned.push(String(url))
      },
      reload: () => {
        reloads++
      },
    },
  })
}
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
})
afterEach(() => {
  if (storageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
  if (locationDescriptor) {
    Object.defineProperty(globalThis, 'location', locationDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'location')
  }
})
test('a page without ?graphics and without a stored preference renders with fast graphics for its whole life', () => {
  expect(graphicsQuality).toBe('fast')
  expect(isHeavyGraphics).toBe(false)
  expect(graphicsQualities).toEqual(['fast', 'heavy', 'cinematic'])
})
test('a load’s graphics come from its permalink over the stored preference over fast, with nothing else the menu could store counting', () => {
  expect(resolveGraphicsModeName('heavy', 'fast')).toBe('heavy')
  expect(resolveGraphicsModeName('auto', 'cinematic')).toBe('auto')
  expect(resolveGraphicsModeName(undefined, 'cinematic')).toBe('cinematic')
  expect(resolveGraphicsModeName()).toBe('fast')
  for (const name of [...graphicsQualities, 'auto'] as const) {
    expect(parseGraphicsModeName(name)).toBe(name)
  }
  for (const value of [undefined, null, '', 'lite', 'Heavy', true, 1]) {
    expect(parseGraphicsModeName(value)).toBeUndefined()
  }
})
test('a permalink carries its graphics directly or packed into its data, and carries none where it says nothing about them', () => {
  expect(readGraphicsModeOverride('https://slop.gallery/?graphics=heavy&seed=1')).toBe('heavy')
  // Given, but nothing the graphics know, so they still override the stored preference as fast.
  expect(readGraphicsModeOverride('https://slop.gallery/?graphics')).toBe('fast')
  expect(readGraphicsModeOverride('https://slop.gallery/?graphics=lite')).toBe('fast')
  // Packed into the data as a flag, they ask for heavy ones, like through the schema the name is read with.
  expect(readGraphicsModeOverride(`https://slop.gallery/?data=${pack({graphics: true})}`)).toBe('heavy')
  expect(readGraphicsModeOverride(`https://slop.gallery/?data=${pack({graphics: 'cinematic'})}`)).toBe('cinematic')
  expect(readGraphicsModeOverride('https://slop.gallery/?seed=1')).toBeUndefined()
  expect(readGraphicsModeOverride('https://slop.gallery/')).toBeUndefined()
})
test('the menu’s flip leaves fast for the page’s own kind of heavy, cinematic only on a cinematic page, and every heavy for fast', () => {
  expect(toggledGraphicsQuality('fast', 'cinematic')).toBe('cinematic')
  expect(toggledGraphicsQuality('fast', 'heavy')).toBe('heavy')
  expect(toggledGraphicsQuality('fast', 'fast')).toBe('heavy')
  expect(toggledGraphicsQuality('heavy', 'cinematic')).toBe('fast')
  expect(toggledGraphicsQuality('cinematic', 'cinematic')).toBe('fast')
})
describe('picking graphics in the menu', () => {
  test('stores the pick for the next load and changes nothing about this page, not even with a reload', () => {
    mockLocation('https://slop.gallery/?seed=1')
    const profile = graphicsProfile
    expect(readNextGraphicsQuality()).toBe('fast')
    expect(planGraphicsPreferenceChange()).toEqual({
      via: 'storage',
      active: 'fast',
      previous: 'fast',
      next: 'heavy',
    })
    expect(values.size).toBe(0)
    expect(toggleGraphicsPreference()).toEqual({
      via: 'storage',
      active: 'fast',
      previous: 'fast',
      next: 'heavy',
    })
    expect(values.get('slop-gallery-graphics')).toBe('heavy')
    expect(readNextGraphicsQuality()).toBe('heavy')
    expect(toggleGraphicsPreference().next).toBe('fast')
    expect(values.get('slop-gallery-graphics')).toBe('fast')
    expect(assigned).toEqual([])
    expect(reloads).toBe(0)
    // The page goes on rendering with the graphics it loaded with.
    expect(graphicsQuality).toBe('fast')
    expect(isHeavyGraphics).toBe(false)
    expect(graphicsProfile).toBe(profile)
  })
  test('the next load’s graphics are the stored ones, whatever this page renders with, and nothing usable stored leaves this page’s', () => {
    mockLocation('https://slop.gallery/')
    values.set('slop-gallery-graphics', 'cinematic')
    expect(readNextGraphicsQuality()).toBe('cinematic')
    expect(toggleGraphicsPreference().next).toBe('fast')
    values.set('slop-gallery-graphics', 'lite')
    expect(readNextGraphicsQuality()).toBe('fast')
  })
  test.each(['fast', '', 'lite'])('on a page whose permalink carries ?graphics=%s, it goes to the same URL with the picked graphics in their place and leaves the stored preference alone', graphics => {
    mockLocation(`https://slop.gallery/?graphics=${graphics}&seed=1#knot`)
    values.set('slop-gallery-graphics', 'cinematic')
    // The permalink’s graphics, not the stored ones, are what its next load goes by.
    expect(readNextGraphicsQuality()).toBe('fast')
    expect(toggleGraphicsPreference()).toEqual({
      via: 'url',
      url: 'https://slop.gallery/?graphics=heavy&seed=1#knot',
      active: 'fast',
      previous: 'fast',
      next: 'heavy',
    })
    expect(assigned).toEqual(['https://slop.gallery/?graphics=heavy&seed=1#knot'])
    expect(reloads).toBe(0)
    expect(values.get('slop-gallery-graphics')).toBe('cinematic')
  })
})
