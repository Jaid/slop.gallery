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
test('a strike’s strength follows how fast it struck within bounds, 1 for a brisk throw', () => {
  expect(impactStrength(7)).toBe(1)
  expect(impactStrength(0.5)).toBe(0.55)
  expect(impactStrength(30)).toBe(1.2)
})
