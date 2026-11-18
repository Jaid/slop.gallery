import {expect, test} from 'bun:test'

import perceptualDistance from '../../src/lib/perceptualDistance.ts'

test('walking distance adds the two horizontal legs and charges three times the elevation change in either direction', () => {
  const a = [-2, 5, 7] as const
  const b = [4, 2, -1] as const
  expect(perceptualDistance(a, a)).toBe(0)
  expect(perceptualDistance(a, b)).toBe(6 + 8 + 3 * 3)
  expect(perceptualDistance({
    x: -2,
    y: 5,
    z: 7,
  }, b)).toBe(perceptualDistance(a, b))
  expect(perceptualDistance(b, a)).toBe(perceptualDistance(a, b))
})
