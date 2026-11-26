import {afterEach, beforeEach, expect, test} from 'bun:test'

import {graphicsProfile, graphicsQualities, graphicsQuality, isCinematicGraphics, isHeavyGraphics, parseStoredGraphics, readGraphicsOverride, resolveGraphicsQuality} from '../../src/lib/rendering/graphicsMode.ts'
import {applyGraphicsChange, planGraphicsToggle, toggleGraphicsQuality, useSelectedGraphics} from '../../src/lib/rendering/graphicsQuality.ts'

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location')
let values: Map<string, string>
let assigned: Array<string>
let reloads: number
const mockLocation = (href: string) => {
  reloads = 0
  assigned = []
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
  assigned = []
  reloads = 0
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  useSelectedGraphics.setState({quality: graphicsQuality})
})
afterEach(() => {
  useSelectedGraphics.setState({quality: graphicsQuality})
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
test('a page without ?graphics or stored preference starts with fast graphics', () => {
  expect(graphicsQuality).toBe('fast')
  expect(isHeavyGraphics).toBe(false)
  expect(isCinematicGraphics).toBe(false)
  expect(useSelectedGraphics.getState().quality).toBe('fast')
  expect(graphicsQualities).toEqual(['fast', 'heavy', 'cinematic'])
})
test('startup graphics resolution prefers URL override over browser storage and defaults to fast', () => {
  expect(readGraphicsOverride('https://slop.gallery/')).toBeUndefined()
  expect(readGraphicsOverride('https://slop.gallery/?seed=1')).toBeUndefined()
  expect(readGraphicsOverride('https://slop.gallery/?graphics=heavy')).toBe('heavy')
  expect(readGraphicsOverride('https://slop.gallery/?graphics=cinematic')).toBe('cinematic')
  expect(readGraphicsOverride('https://slop.gallery/?graphics=auto')).toBe('auto')
  expect(readGraphicsOverride('https://slop.gallery/?graphics=')).toBe('fast')
  expect(readGraphicsOverride('https://slop.gallery/?graphics=nonsense')).toBe('fast')
  // Encoded permalink data payload overrides graphics too.
  const packed = btoa(JSON.stringify({graphics: 'heavy'}))
  expect(readGraphicsOverride(`https://slop.gallery/?data=${encodeURIComponent(packed)}`)).toBe('heavy')
  expect(parseStoredGraphics(null)).toBeUndefined()
  expect(parseStoredGraphics('ultra')).toBeUndefined()
  expect(parseStoredGraphics('heavy')).toBe('heavy')
  expect(parseStoredGraphics('fast')).toBe('fast')
  expect(parseStoredGraphics('cinematic')).toBe('cinematic')
  expect(parseStoredGraphics('auto')).toBe('auto')
  expect(resolveGraphicsQuality(undefined, null, false)).toBe('fast')
  expect(resolveGraphicsQuality(undefined, 'heavy', false)).toBe('heavy')
  expect(resolveGraphicsQuality(undefined, 'cinematic', false)).toBe('cinematic')
  expect(resolveGraphicsQuality(undefined, 'auto', true)).toBe('heavy')
  expect(resolveGraphicsQuality(undefined, 'auto', false)).toBe('fast')
  expect(resolveGraphicsQuality(undefined, 'nonsense', true)).toBe('fast')
  // URL overrides beat browser storage.
  expect(resolveGraphicsQuality('fast', 'heavy', true)).toBe('fast')
  expect(resolveGraphicsQuality('heavy', 'fast', false)).toBe('heavy')
  expect(resolveGraphicsQuality('cinematic', 'fast', false)).toBe('cinematic')
  expect(resolveGraphicsQuality('auto', 'heavy', false)).toBe('fast')
  expect(resolveGraphicsQuality('auto', 'fast', true)).toBe('heavy')
})
test('toggling graphics without a ?graphics URL override updates localStorage and the menu label without reloading or changing the running session', () => {
  mockLocation('https://slop.gallery/?seed=1')
  const profileBefore = graphicsProfile
  toggleGraphicsQuality()
  expect(values.get('slop-gallery-graphics')).toBe('heavy')
  expect(useSelectedGraphics.getState().quality).toBe('heavy')
  expect(assigned).toEqual([])
  expect(reloads).toBe(0)
  // Running session remains unchanged until next reload.
  expect(graphicsQuality).toBe('fast')
  expect(graphicsProfile).toBe(profileBefore)
  toggleGraphicsQuality()
  expect(values.get('slop-gallery-graphics')).toBe('fast')
  expect(useSelectedGraphics.getState().quality).toBe('fast')
  expect(assigned).toEqual([])
  expect(reloads).toBe(0)
})
test.each([
  ['fast', 'fast', 'heavy'],
  ['heavy', 'heavy', 'fast'],
  ['cinematic', 'cinematic', 'fast'],
  ['auto', 'heavy', 'fast'],
  ['auto', 'fast', 'heavy'],
  ['', 'fast', 'heavy'],
  ['nonsense', 'fast', 'heavy'],
] as const)('toggling graphics with ?graphics=%s (running %s) navigates to ?graphics=%s without touching localStorage', (param, current, expected) => {
  mockLocation(`https://slop.gallery/?seed=7&graphics=${param}&audio#knot`)
  values.set('slop-gallery-graphics', 'heavy')
  useSelectedGraphics.setState({quality: current})
  const plan = planGraphicsToggle()
  expect(plan.via).toBe('url')
  expect(plan.previous).toBe(current)
  expect(plan.quality).toBe(expected)
  applyGraphicsChange(plan)
  expect(assigned).toHaveLength(1)
  const url = new URL(assigned[0])
  expect(url.origin + url.pathname + url.hash).toBe('https://slop.gallery/#knot')
  expect(url.searchParams.keys().toArray()).toEqual(['seed', 'graphics', 'audio'])
  expect(url.searchParams.get('seed')).toBe('7')
  expect(url.searchParams.get('graphics')).toBe(expected)
  expect(reloads).toBe(0)
  expect(values.get('slop-gallery-graphics')).toBe('heavy')
})
