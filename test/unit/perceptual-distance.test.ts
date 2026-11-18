import {expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {perceptualDistance, walkingDistance} from '../../src/lib/geometry.ts'

test('perceptual distance uses horizontal Manhattan distance and triples vertical travel', () => {
  expect(perceptualDistance([1, 2, 3], [4, 0, 8])).toBe(14)
  expect(perceptualDistance(new Vector3(-1, 5, 2), new Vector3(2, 3, -2))).toBe(13)
  expect(walkingDistance([0, 0, 0], {
    x: 2,
    y: -1,
    z: 4,
  })).toBe(9)
})
