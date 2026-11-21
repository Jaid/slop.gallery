import {expect, test} from 'bun:test'

import {Geofence} from 'geofency'

import fenceEdges from '../../src/components/GeofenceOutlines/fenceEdges.ts'
import {readShowFence, selectFences} from '../../src/lib/gallery/fenceDisplay.ts'

test('the fence overlay starts off unless the URL asks for every fence or names one', () => {
  expect(readShowFence('')).toBe(false)
  expect(readShowFence('?show_fence=false')).toBe(false)
  expect(readShowFence('?show_fence')).toBe(true)
  expect(readShowFence('?show_fence=true')).toBe(true)
  expect(readShowFence('?show_fence=moonfall-stairs')).toBe('moonfall-stairs')
})
test('a URL pattern selects matching fence IDs, not their prefixes or unmatched alternatives', () => {
  const fences = new Map(['lobby', 'lobby-north', 'lodge', 'lodge-test', 'vesper'].map(id => [id, id]))
  const shown = (url: string) => selectFences(fences, readShowFence(url)).map(([id]) => id)
  expect(shown('?show_fence=%7Blobby%2Clodge*%7D')).toEqual(['lobby', 'lodge', 'lodge-test'])
  expect(shown('?show_fence={lobby,logde*}')).toEqual(['lobby'])
  expect(shown('?show_fence=lodge')).toEqual(['lodge'])
  expect(shown('?show_fence=unknown*')).toEqual([])
})
test('each box of a translated compound fence gets four uprights and rims only at its real bounds', () => {
  const footprint = {
    x: 0,
    x2: 2,
    z: 0,
    z2: 3,
  }
  const fence = new Geofence([{
    ...footprint,
    y: 1,
    y2: 4,
  }, {
    ...footprint,
    floor: 2,
  }, {
    ...footprint,
    ceiling: 3,
  }, footprint])
  const edges = fenceEdges(fence.translate([10, 5, -9]), 100)
  const rims: Array<number> = []
  const uprights: Array<[number, number]> = []
  for (let i = 0; i < edges.length; i += 6) {
    const [x, y, z, x2, y2, z2] = edges.subarray(i, i + 6)
    expect([10, 12]).toContain(x)
    expect([-9, -6]).toContain(z)
    if (y === y2) {
      rims.push(y)
    } else {
      expect([x2, z2]).toEqual([x, z])
      expect(Number.isFinite(y) && y < y2 && Number.isFinite(y2)).toBe(true)
      uprights.push([y, y2])
    }
  }
  expect(rims.toSorted((a, b) => a - b)).toEqual([6, 7, 8, 9].flatMap(y => [y, y, y, y]))
  expect(uprights).toHaveLength(16)
})
