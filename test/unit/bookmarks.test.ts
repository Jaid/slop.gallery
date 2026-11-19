import type {SpawnBookmark} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {nextBookmark} from '../../src/lib/gallery/bookmarks.ts'

const bookmark = (id: string, x: number, z: number): SpawnBookmark => ({
  id,
  position: [x, 0, z],
  yaw: 0,
  pitch: 0,
})
const list = [bookmark('first', 0, 0), bookmark('second', 3, 0), bookmark('third', 20, 0)]
test('away from every bookmark, T picks the closest one', () => {
  expect(nextBookmark([1.8, 0, 0], list)).toBe(1)
  expect(nextBookmark([15, 0, 0], list)).toBe(2)
})
test('within a meter of a bookmark, T cycles on to the next one', () => {
  expect(nextBookmark([0.6, 0, 0.6], list)).toBe(1)
  expect(nextBookmark([3, 0, 0], list)).toBe(2)
  expect(nextBookmark([20, 0, 0.9], list)).toBe(0)
})
test('with Shift, T cycles back to the previous one', () => {
  expect(nextBookmark([3, 0, 0], list, true)).toBe(0)
  expect(nextBookmark([0, 0, 0.5], list, true)).toBe(2)
  expect(nextBookmark([15, 0, 0], list, true)).toBe(2)
})
test('a world without bookmarks has no target', () => {
  expect(nextBookmark([0, 0, 0], [])).toBeNull()
})
