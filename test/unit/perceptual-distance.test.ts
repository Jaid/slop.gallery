import {describe, expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {nearestFirst} from '../../src/components/World/index.tsx'
import perceptualDistance from '../../src/lib/perceptualDistance.ts'
import {acquireArtworkTexture} from '../../src/lib/useArtworkTexture.ts'

describe('perceptualDistance', () => {
  test('combines horizontal Manhattan distance with 3× vertical difference', () => {
    expect(perceptualDistance([0, 0, 0], [0, 0, 0])).toBe(0)
    expect(perceptualDistance([1, 2, -3], [4, 2, 2])).toBe(3 + 5)
    expect(perceptualDistance([0, 0, 0], [0, 4, 0])).toBe(12)
    expect(perceptualDistance([1, -2, 5], [-2, 1, 1])).toBe(3 + 4 + 3 * 3)
  })
  test('is symmetric and accepts tuples, objects and Vector3 interchangeably', () => {
    const tuple = [2, 1.5, -4] as const
    const plain = {
      x: -1,
      y: 3.5,
      z: 2,
    }
    const vector = new Vector3(-1, 3.5, 2)
    const expected = 3 + 6 + 3 * 2
    expect(perceptualDistance(tuple, plain)).toBe(expected)
    expect(perceptualDistance(plain, tuple)).toBe(expected)
    expect(perceptualDistance(tuple, vector)).toBe(expected)
    expect(perceptualDistance(vector, plain)).toBe(0)
  })
})
describe('nearestFirst room loading order', () => {
  test('orders rooms within each hop by perceptual distance from the camera', () => {
    // At the Lobby’s north extension (near Salon and Forge), those two come ahead of the Antechamber and lower-floor rooms.
    const north = nearestFirst(['lobby'], [0, 1.6, -24])
    expect(north[0]).toBe('lobby')
    expect(north.indexOf('salon')).toBeLessThan(north.indexOf('antechamber'))
    expect(north.indexOf('forge')).toBeLessThan(north.indexOf('antechamber'))
    expect(north.indexOf('antechamber')).toBeLessThan(north.indexOf('moonfall'))
    // Near the Lobby’s south arch into the Antechamber, the Antechamber precedes Salon and Forge.
    const south = nearestFirst(['lobby'], [0, 1.6, 12])
    expect(south.indexOf('antechamber')).toBeLessThan(south.indexOf('salon'))
    expect(south.indexOf('antechamber')).toBeLessThan(south.indexOf('forge'))
    // Hop-2 rooms follow all direct neighbors, ordered nearest first for each position.
    expect(north.slice(-2)).toEqual(['lodge', 'corridor'])
    expect(south.slice(-2)).toEqual(['corridor', 'lodge'])
    expect(new Set(north)).toEqual(new Set(south))
  })
})
describe('artwork texture priority queue', () => {
  test('starts queued loads nearest first and upgrades priority if acquired closer before flushing', async () => {
    const started: Array<string> = []
    const loader = async (source: Blob | string) => {
      started.push(typeof source === 'string' ? source : 'blob')
      return {dispose: () => {}} as never
    }
    const far = acquireArtworkTexture('/test-far.jxl', 40, loader)
    const mid = acquireArtworkTexture('/test-mid.jxl', 15, loader)
    const near = acquireArtworkTexture('/test-near.jxl', 4, loader)
    // A second request with a lower distance promotes /test-far.jxl ahead of /test-mid.jxl.
    const promoted = acquireArtworkTexture('/test-far.jxl', 8, loader)
    expect(promoted).toBe(far)
    await Promise.all([far.promise, mid.promise, near.promise])
    expect(started).toEqual(['/test-near.jxl', '/test-far.jxl', '/test-mid.jxl'])
  })
})
