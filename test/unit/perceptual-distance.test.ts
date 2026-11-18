import {describe, expect, test} from 'bun:test'

import {Box3, Vector3} from 'three/webgpu'

import nearestPortraits from '../../src/lib/gallery/nearestPortraits.ts'
import {perceptualDistance, perceptualDistanceToBox, verticalWeight} from '../../src/lib/perceptualDistance.ts'
import samplePortraits from './fixtures/portraits.ts'

describe('perceptualDistance', () => {
  test('adds up the distances along x and z and three times the one along y', () => {
    expect(verticalWeight).toBe(3)
    expect(perceptualDistance([0, 0, 0], [3, 0, 4])).toBe(7)
    expect(perceptualDistance([1, 2, 3], [-1, 0, 5])).toBe(2 + 2 + 3 * 2)
    expect(perceptualDistance([0, 0, 0], [0, -1.5, 0])).toBe(4.5)
  })
  test('takes tuples and vectors alike, either way round', () => {
    const a = new Vector3(1, 2, 3)
    const b: [number, number, number] = [4, -2, 0]
    expect(perceptualDistance(a, b)).toBe(3 + 3 + 12)
    expect(perceptualDistance(b, a)).toBe(perceptualDistance(a, b))
    expect(perceptualDistance({
      x: 4,
      y: -2,
      z: 0,
    }, [1, 2, 3])).toBe(18)
    expect(perceptualDistance(a, a)).toBe(0)
  })
  test('ranks a floor up or down as farther than a few steps along it', () => {
    // a work on the floor below, right under the player, against one 6 m away on the same floor
    expect(perceptualDistance([0, 1.6, 0], [0, -6.4, 0])).toBeGreaterThan(perceptualDistance([0, 1.6, 0], [6, 1.6, 0]))
  })
})
describe('perceptualDistanceToBox', () => {
  const box = new Box3(new Vector3(-1, 0, -2), new Vector3(1, 3, 2))
  test('measures to the nearest point of the box, 0 inside it', () => {
    expect(perceptualDistanceToBox([0, 1, 0], box)).toBe(0)
    expect(perceptualDistanceToBox([1, 3, 2], box)).toBe(0)
    expect(perceptualDistanceToBox([3, 1, 0], box)).toBe(2)
    expect(perceptualDistanceToBox([3, 1, -5], box)).toBe(2 + 3)
    expect(perceptualDistanceToBox([0, -2, 0], box)).toBe(6)
    expect(perceptualDistanceToBox(new Vector3(-4, 5, 4), box)).toBe(3 + 2 + 3 * 2)
  })
  test('agrees with the distance to a point for a box around just that point', () => {
    const point = new Box3(new Vector3(2, -1, 5), new Vector3(2, -1, 5))
    expect(perceptualDistanceToBox([0, 0, 0], point)).toBe(perceptualDistance([0, 0, 0], [2, -1, 5]))
  })
  test('puts an empty box infinitely far away', () => {
    expect(perceptualDistanceToBox([0, 0, 0], new Box3)).toBe(Number.POSITIVE_INFINITY)
  })
})
/** a work at the position */
const at = (id: string, position: [number, number, number]) => ({
  ...samplePortraits[0],
  id,
  position,
})
describe('nearestPortraits', () => {
  test('lists the works nearest to the point first, a floor away counting as far', () => {
    const works = [
      at('far', [20, 1.5, 0]),
      at('below', [0, -6.5, 1]),
      at('near', [2, 1.5, -1]),
      at('across', [-6, 1.5, 4]),
    ]
    expect(nearestPortraits(works, [0, 1.6, 0]).map(work => work.id)).toEqual(['near', 'across', 'far', 'below'])
  })
  test('keeps the order of works equally far and leaves the list it was given as it was', () => {
    const works = [at('a', [1, 0, 0]), at('b', [0, 0, 1]), at('c', [-1, 0, 0]), at('d', [0, 0, 0])]
    expect(nearestPortraits(works, [0, 0, 0]).map(work => work.id)).toEqual(['d', 'a', 'b', 'c'])
    expect(works.map(work => work.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
