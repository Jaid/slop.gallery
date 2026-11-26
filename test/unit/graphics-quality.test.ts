import {afterEach, beforeEach, expect, mock, test} from 'bun:test'

import readPermalink from 'read-permalink'

import {chooseGraphics, readGraphicsOverride, readStoredGraphics} from '../../src/lib/rendering/graphicsPreference.ts'

const saved = new Map<string, string>
const key = 'slop-gallery-graphics'
const assigned = mock((_href: string) => {})
const reload = mock(() => {})
const page = {
  assign: assigned,
  href: '',
  reload,
}
const descriptors = new Map(['location', 'localStorage', 'history'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
const globals = (values: Record<string, unknown>) => {
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value,
    })
  }
}
beforeEach(() => {
  saved.clear()
  assigned.mockClear()
  reload.mockClear()
  page.href = 'https://slop.gallery/museum?room=cell&paused#art'
  globals({
    localStorage: {
      getItem: (name: string) => saved.get(name) ?? null,
      setItem: (name: string, value: string) => saved.set(name, value),
    },
    location: page,
    history: {pushState: (_data: unknown, _title: string, url: URL) => {
      page.href = url.href
    }},
  })
})
afterEach(() => {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }
})
// A fresh instance of the startup module, just as in a new document. No setter or reset hook on the renderer’s configuration.
let loads = 0
const load = () => import(`../../src/lib/rendering/graphicsMode.ts?load=${++loads}`) as Promise<typeof import('../../src/lib/rendering/graphicsMode.ts')>
test('changing the saved preset leaves the page and its active profile alone until a fresh load', async () => {
  const initial = await load()
  expect(initial.graphicsQuality).toBe('fast')
  expect(initial.graphicsProfile).toBe(initial.graphicsProfiles.fast)
  expect(chooseGraphics('heavy')).toBe(true)
  expect(readStoredGraphics()).toBe('heavy')
  expect(saved.get(key)).toBe('heavy')
  expect(initial.isHeavy).toBe(false)
  expect(initial.graphicsProfile.shadows).toBe(false)
  expect(assigned).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
  const next = await load()
  expect(next.graphicsQuality).toBe('heavy')
  expect(next.isHeavy).toBe(true)
  expect(next.graphicsProfile).toBe(next.graphicsProfiles.heavy)
})
test('invalid or blocked storage falls back to Fast; a failed save does not navigate', async () => {
  saved.set(key, 'junk')
  expect(readStoredGraphics()).toBe('fast')
  globals({localStorage: undefined})
  const loaded = await load()
  expect(loaded.graphicsQuality).toBe('fast')
  expect(chooseGraphics('heavy')).toBe(false)
  expect(assigned).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
})
test('the permalink distinguishes an absent override from Fast, including invalid explicit inputs', () => {
  expect(readGraphicsOverride()).toBeUndefined()
  for (const preset of ['fast', 'heavy', 'cinematic', 'auto'] as const) {
    expect(readGraphicsOverride(`?graphics=${preset}`)).toBe(preset)
  }
  for (const query of ['?graphics', '?graphics=', '?graphics=true', '?graphics=false', '?graphics=Auto', '?graphics=Cinematic', '?graphics=unknown']) {
    expect(readGraphicsOverride(query)).toBe('fast')
  }
})
test('an explicit preset wins over storage; changing it navigates without saving', async () => {
  saved.set(key, 'heavy')
  page.href = 'https://slop.gallery/museum?graphics=fast&room=cell&graphics=cinematic&paused#art'
  const initial = await load()
  expect(initial.graphicsQuality).toBe('cinematic')
  expect(initial.graphicsProfile).toBe(initial.graphicsProfiles.cinematic)
  expect(initial.isHeavy).toBe(true)
  expect(chooseGraphics('fast')).toBe(true)
  expect(assigned).toHaveBeenCalledTimes(1)
  expect(reload).not.toHaveBeenCalled()
  const target = new URL(assigned.mock.calls[0][0])
  expect(target.origin + target.pathname + target.hash).toBe('https://slop.gallery/museum#art')
  expect(Object.fromEntries(target.searchParams)).toEqual({
    room: 'cell',
    graphics: 'fast',
    paused: '',
  })
  expect(target.searchParams.getAll('graphics')).toEqual(['fast'])
  expect(saved.get(key)).toBe('heavy')
  expect(initial.graphicsQuality).toBe('cinematic')
  page.href = target.href
  const loaded = await load()
  expect(loaded.graphicsQuality).toBe('fast')
})
test('packed overrides keep their other fields and the new choice wins on the next page', () => {
  const data = {
    graphics: true,
    caption: '夜',
  }
  const encoder = new TextEncoder
  const payload = encoder.encode(JSON.stringify(data)).toBase64({alphabet: 'base64url'})
  page.href = `https://slop.gallery/?graphics=fast&data=${payload}#art`
  expect(readGraphicsOverride()).toBe('heavy')
  chooseGraphics('fast')
  const query = new URL(assigned.mock.calls[0][0])
  expect(readGraphicsOverride(query)).toBe('fast')
  expect(query.searchParams.get('data')).toBe(payload)
  expect(query.hash).toBe('#art')
  page.href = `https://slop.gallery/?room=cell#data:${payload}`
  chooseGraphics('fast')
  expect(reload).toHaveBeenCalledTimes(1)
  const target = new URL(page.href)
  expect(target.search).toBe('?room=cell')
  expect(readPermalink(page.href)).toEqual({
    room: 'cell',
    ...data,
    graphics: 'fast',
  })
  expect(saved.has(key)).toBe(false)
})
