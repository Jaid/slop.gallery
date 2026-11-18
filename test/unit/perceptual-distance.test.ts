import {expect, test} from 'bun:test'

import {perceptualDistance} from '../../src/lib/perceptualDistance.ts'

test('perceptual distance adds horizontal travel and counts elevation three times', () => {
  const a = [2, -1, 4] as const
  const b = [-3, 2, 1] as const
  expect(perceptualDistance(a, b)).toBe(5 + 3 + 3 * 3)
  expect(perceptualDistance(b, a)).toBe(perceptualDistance(a, b))
  expect(perceptualDistance(a, a)).toBe(0)
  expect(perceptualDistance(a, [2, -3, 4])).toBe(6)
})
