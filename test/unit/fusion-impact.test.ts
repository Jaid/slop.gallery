import {expect, test} from 'bun:test'

import {Group} from 'three/webgpu'

import {imagePoint, impactStrength} from '../../src/lib/gallery/fusion/impact/strike.ts'

/** the group of a work facing +x, its middle at (2, 1.8, −1) */
const facingX = () => {
  const group = new Group
  group.position.set(2, 1.8, -1)
  group.rotation.y = Math.PI / 2
  return group
}
test('a strike lands in the image’s plane where it struck, as the work stands', () => {
  // To the right of someone facing the work is −z here.
  const [x, y] = imagePoint(facingX(), [2.05, 2, -1.3])
  expect(x).toBeCloseTo(0.3)
  expect(y).toBeCloseTo(0.2)
})
test('a strike on the frame or beside it lands there, past the image’s edge', () => {
  const [x, y] = imagePoint(facingX(), [2, 3, -3])
  expect(x).toBeCloseTo(2)
  expect(y).toBeCloseTo(1.2)
})
test('a strike’s strength grows with how fast it struck, within bounds, 1 for a brisk throw', () => {
  const speeds = [0, 0.5, 3, 5, 7, 9, 30, 100]
  const strengths = speeds.map(speed => impactStrength(speed))
  for (const [index, strength] of strengths.entries()) {
    expect(strength).toBeGreaterThan(0)
    expect(strength).toBeGreaterThanOrEqual(strengths[index - 1] ?? 0)
  }
  expect(impactStrength(7)).toBe(1)
  expect(impactStrength(3)).toBeLessThan(1)
  expect(impactStrength(9)).toBeGreaterThan(1)
  expect(impactStrength(0)).toBe(impactStrength(0.5))
  expect(impactStrength(100)).toBe(impactStrength(30))
})
