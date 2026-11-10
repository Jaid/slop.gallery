import {expect, test} from 'bun:test'

import defaultPortraits, {hangDefaultWorks, readPortraitSet} from '../../src/lib/gallery/defaultPortraits.ts'
import artworks from '../../src/worlds/gallery/artworks.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

const slots = slopGallery.portraitSlots()
test('default works hang in distinct slots of their ratio, taking the slot’s size', () => {
  const portraits = defaultPortraits(7)
  expect(portraits.map(portrait => portrait.id)).toEqual(artworks.map(artwork => artwork.id))
  const used = new Set<string>
  for (const [index, portrait] of portraits.entries()) {
    const slot = slots.find(candidate => candidate.wallId === portrait.wallId && candidate.position.every((value, axis) => value === portrait.position[axis]))!
    expect(slot.ratio).toBe(artworks[index].ratio)
    expect([portrait.width, portrait.height, portrait.rotation]).toEqual([slot.width, slot.height, slot.rotation])
    expect(portrait.hung).toBe(true)
    expect(used.has(slot.id)).toBe(false)
    used.add(slot.id)
  }
})
test('the seed decides the assignment, and the same seed repeats it', () => {
  expect(defaultPortraits(7)).toEqual(defaultPortraits(7))
  const layouts = new Set([1, 2, 3, 4, 5].map(seed => JSON.stringify(defaultPortraits(seed).map(portrait => portrait.position))))
  expect(layouts.size).toBeGreaterThan(1)
})
test('with fewer slots than works, as in the Sandbox, the seed draws which works hang, every slot of a ratio with works taking one', () => {
  const ratios = new Set(sandbox.artworks.map(artwork => artwork.ratio))
  const sandboxSlots = sandbox.portraitSlots().filter(slot => ratios.has(slot.ratio))
  const hang = (seed: number) => hangDefaultWorks(sandbox.portraitSlots(), sandbox.artworks, seed)
  for (const seed of [1, 2, 3, 4, 5]) {
    const portraits = hang(seed)
    expect(portraits).toHaveLength(sandboxSlots.length)
    const spots = new Set(portraits.map(portrait => `${portrait.wallId} ${portrait.position.join()}`))
    expect(spots.size).toBe(sandboxSlots.length)
    for (const portrait of portraits) {
      const slot = sandboxSlots.find(candidate => candidate.wallId === portrait.wallId && candidate.position.every((value, axis) => value === portrait.position[axis]))!
      expect(slot.ratio).toBe(sandbox.artworks.find(artwork => artwork.id === portrait.id)!.ratio)
    }
  }
  expect(hang(7)).toEqual(hang(7))
  const selections = new Set([1, 2, 3, 4, 5].map(seed => hang(seed).map(portrait => portrait.id).toSorted().join()))
  expect(selections.size).toBeGreaterThan(1)
})
test('a work whose ratio has no slot at all is an error', () => {
  expect(() => hangDefaultWorks(slots.filter(slot => slot.ratio !== '1:1'), artworks, 1)).toThrow(/No 1:1 portrait slot/u)
})
test('?portrait_set is classic unless it is false', () => {
  for (const search of ['', '?portrait_set', '?portrait_set=classic', '?portrait_set=modern']) {
    expect(readPortraitSet(`https://example.com/${search}`)).toBe('classic')
  }
  expect(readPortraitSet('https://example.com/?portrait_set=false')).toBe(false)
})
