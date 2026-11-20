import {expect, test} from 'bun:test'

import defaultPortraits, {hangDefaultWorks, readPortraitCount} from '../../src/lib/gallery/defaultPortraits.ts'
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
test('?portraits caps the selection or repeats works in spare matching slots', () => {
  const compatible = slots.filter(slot => artworks.some(work => work.ratio === slot.ratio))
  for (const count of [0, 4, artworks.length + 1, compatible.length + 100]) {
    const portraits = hangDefaultWorks(slots, artworks, 7, readPortraitCount(`?portraits=${count}`))
    expect(portraits).toHaveLength(Math.min(count, compatible.length))
    const sources = new Set(portraits.map(portrait => portrait.source))
    const ids = new Set(portraits.map(portrait => portrait.id))
    expect(sources.size).toBe(Math.min(count, artworks.length))
    expect(ids.size).toBe(portraits.length)
    const occupied = portraits.map(portrait => {
      const slot = compatible.find(candidate => candidate.wallId === portrait.wallId && candidate.position.every((value, axis) => value === portrait.position[axis]))!
      expect(slot.ratio).toBe(artworks.find(work => work.source === portrait.source)!.ratio)
      return slot.id
    })
    const spots = new Set(occupied)
    expect(spots.size).toBe(portraits.length)
    expect(hangDefaultWorks(slots, artworks, 7, count)).toEqual(portraits)
  }
  expect(hangDefaultWorks([], [], 7, 100)).toEqual([])
})
test('only a nonnegative integer overrides the default portrait count', () => {
  for (const search of ['', '?portraits', '?portraits=-1', '?portraits=2.5', '?portraits=false']) {
    expect(readPortraitCount(search)).toBeUndefined()
  }
})
