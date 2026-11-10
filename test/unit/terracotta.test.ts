import {expect, test} from 'bun:test'

import {NoColorSpace, RepeatWrapping, SRGBColorSpace} from 'three/webgpu'

import TerracottaTextures from '../../src/lib/materials/TerracottaTextures.ts'

test('clay maps have deterministic, independently owned and correctly filtered pixels', () => {
  const a = new TerracottaTextures
  const b = new TerracottaTextures
  try {
    expect(a.map.colorSpace).toBe(SRGBColorSpace)
    expect(a.bumpMap.colorSpace).toBe(NoColorSpace)
    expect(a.roughnessMap.colorSpace).toBe(NoColorSpace)
    for (const key of ['map', 'bumpMap', 'roughnessMap'] as const) {
      const map = a[key]
      expect(map.image.data).not.toBe(b[key].image.data)
      expect(map.image.data).toEqual(b[key].image.data)
      // The maps share one layout, wrapping round the pot.
      expect([map.image.width, map.image.height]).toEqual([a.map.image.width, a.map.image.height])
      expect(map.wrapS).toBe(RepeatWrapping)
      expect(map.generateMipmaps).toBe(true)
      expect(map.anisotropy).toBeGreaterThan(1)
      expect(map.repeat.toArray()).toEqual([1, 1])
      const pixels = map.image.data!
      const values = new Set<number>
      for (let i = 0; i < pixels.length; i += 4) {
        values.add(pixels[i])
        if (pixels[i + 3] !== 255) {
          throw new Error('Clay must be opaque.')
        }
        if (key === 'roughnessMap' && pixels[i + 1] < 210) {
          throw new Error('Unglazed clay must stay matte.')
        }
      }
      expect(values.size).toBeGreaterThan(15)
    }
  } finally {
    a.dispose()
    b.dispose()
  }
})
test('clay releases its color, bump and roughness maps together', () => {
  const textures = new TerracottaTextures
  const disposed: Array<string> = []
  for (const key of ['map', 'bumpMap', 'roughnessMap'] as const) {
    textures[key].addEventListener('dispose', () => disposed.push(key))
  }
  textures.dispose()
  expect(disposed).toEqual(['map', 'bumpMap', 'roughnessMap'])
})
test('pores average out at a distance instead of forming cloudy patches', () => {
  const textures = new TerracottaTextures
  try {
    const {data, width, height} = textures.map.image
    const averages: Array<number> = []
    for (let y = 0; y < height; y += 32) {
      for (let x = 0; x < width; x += 32) {
        let total = 0
        for (let dy = 0; dy < 32; dy++) {
          for (let dx = 0; dx < 32; dx++) {
            total += data![((y + dy) * width + x + dx) * 4]
          }
        }
        averages.push(total / 1024)
      }
    }
    expect(Math.max(...averages) - Math.min(...averages)).toBeLessThan(1)
  } finally {
    textures.dispose()
  }
})
