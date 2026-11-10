import {describe, expect, test} from 'bun:test'

import {vec3} from 'three/tsl'

import {cellularBoundary} from '../src/lib/cellularBoundary.ts'
import {cellularPoints} from '../src/lib/cellularPoints.ts'

describe('Knot cellular fields', () => {
  test('constructs real distance fields and rejects support that could reach another feature', () => {
    expect(cellularBoundary(vec3(0)).isNode).toBe(true)
    expect(cellularPoints(vec3(0)).isNode).toBe(true)
    expect(cellularPoints(vec3(0), 0, 0.24, 0.9).isNode).toBe(true)
    for (const [inner, outer, threshold] of [[-1, 0.2, 0.5], [0.2, 0.2, 0.5], [0.1, 0.25, 0.5], [0.1, 0.2, 1], [0.1, 0.2, -1], [0.1, Number.NaN, 0.5]]) {
      expect(() => cellularPoints(vec3(0), inner, outer, threshold)).toThrow(RangeError)
    }
  })
})
