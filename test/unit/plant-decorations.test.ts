import {describe, expect, test} from 'bun:test'

import {BoxGeometry, BufferGeometry, Mesh, MeshBasicNodeMaterial, Raycaster, Vector3} from 'three/webgpu'

import {plants, pots} from '../../src/lib/gallery/plantDecorations/catalog.ts'
import PlantGeometry from '../../src/lib/gallery/plantDecorations/PlantGeometry.ts'
import PotGeometry from '../../src/lib/gallery/plantDecorations/PotGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'

describe('modular botanical catalog', () => {
  test('every vessel and every botanical has an ID of its own', () => {
    const ids = new Set([...pots, ...plants].map(item => item.id))
    expect(ids.size).toBe(pots.length + plants.length)
  })
  test('cinematic rounds the celadon shell but keeps its convex hull identical to the other graphics modes', () => {
    const heavy = new PotGeometry('celadon')
    const location = Object.getOwnPropertyDescriptor(globalThis, 'location')
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {href: 'https://slop.gallery/?graphics=cinematic'},
    })
    try {
      const cinematic = new PotGeometry('celadon')
      expect(triangleCount(cinematic.shell)).toBeGreaterThan(triangleCount(heavy.shell))
      expect(cinematic.vertices).toEqual(heavy.vertices)
      cinematic.dispose()
    } finally {
      if (location) {
        Object.defineProperty(globalThis, 'location', location)
      } else {
        Reflect.deleteProperty(globalThis, 'location')
      }
      heavy.dispose()
    }
  })
  test('every pot is hollow above its fitted, recessed soil and has a distinct silhouette', () => {
    const material = new MeshBasicNodeMaterial
    const hashes = new Set<bigint | number>
    try {
      for (const pot of pots) {
        const geometry = new PotGeometry(pot.id)
        try {
          hashes.add(Bun.hash(geometry.vertices))
          const shell = new Mesh(geometry.shell, material)
          shell.updateMatrixWorld(true)
          const cavityRay = new Raycaster(new Vector3(0.1, 1, 0), new Vector3(0, -1, 0))
          const down = cavityRay.intersectObject(shell)
          expect(down[0].point.y).toBeLessThan(pot.soilHeight - 0.1)
          for (let i = 0; i < 16; i++) {
            const angle = i * Math.PI / 8
            const radialRay = new Raycaster(new Vector3(0, pot.soilHeight, 0), new Vector3(Math.cos(angle), 0, Math.sin(angle)))
            const inside = radialRay.intersectObject(shell)
            expect(inside[0].distance).toBeGreaterThanOrEqual(pot.soilRadius)
            expect(inside[0].distance - pot.soilRadius).toBeLessThan(0.006)
          }
          geometry.soil.computeBoundingBox()
          expect(geometry.soil.boundingBox!.max.y).toBeCloseTo(pot.soilHeight)
          expect(pot.height - pot.soilHeight).toBeGreaterThanOrEqual(0.07)
          expect(geometry.shell.boundingBox!.max.y).toBeCloseTo(pot.height)
          expect(geometry.vertices).toEqual(Float32Array.from(geometry.shell.getAttribute('position').array))
          expect(Boolean(geometry.trim)).toBe(pot.id === 'noir')
        } finally {
          geometry.dispose()
        }
      }
      expect(hashes.size).toBe(4)
    } finally {
      material.dispose()
    }
  })
  test('the atelier clay pot stays within its triangle budget, including soil', () => {
    const geometry = new PotGeometry('atelier')
    try {
      const triangles = triangleCount(geometry.shell) + triangleCount(geometry.soil) + triangleCount(geometry.trim)
      expect(triangles).toBeGreaterThanOrEqual(2500)
      expect(triangles).toBeLessThanOrEqual(3000)
    } finally {
      geometry.dispose()
    }
  })
  test('the ivory flute pot stays within its triangle budget and retains all 40 evenly spaced flutes', () => {
    const geometry = new PotGeometry('ivory')
    try {
      const triangles = triangleCount(geometry.shell) + triangleCount(geometry.soil) + triangleCount(geometry.trim)
      expect(triangles).toBeGreaterThanOrEqual(4000)
      expect(triangles).toBeLessThanOrEqual(6000)
      const {points, segments} = geometry.shell.parameters
      const ring = points.findIndex(point => point.y === 0.45)
      expect(ring).toBeGreaterThanOrEqual(0)
      expect(segments % 40).toBe(0)
      const positions = geometry.shell.getAttribute('position')
      const radiusAt = (segment: number) => {
        const vertex = segment * points.length + ring
        return Math.hypot(positions.getX(vertex), positions.getZ(vertex))
      }
      const amplitude = 0.012 * Math.sin(Math.PI * 0.45 / 0.76)
      const samplesPerFlute = segments / 40
      for (let flute = 0; flute < 40; flute++) {
        const peak = radiusAt(flute * samplesPerFlute)
        const trough = radiusAt(flute * samplesPerFlute + Math.floor(samplesPerFlute / 2))
        expect(peak).toBeCloseTo(0.319 + amplitude, 6)
        // Preserve at least 90% of the original crest-to-trough relief.
        expect(peak - trough).toBeGreaterThanOrEqual(amplitude * 0.9)
      }
      expect(radiusAt(segments)).toBeCloseTo(radiusAt(0), 6)
    } finally {
      geometry.dispose()
    }
  })
  test('the celadon pebble pot stays within its triangle budget, including soil', () => {
    const geometry = new PotGeometry('celadon')
    try {
      const triangles = triangleCount(geometry.shell) + triangleCount(geometry.soil) + triangleCount(geometry.trim)
      expect(triangles).toBeGreaterThanOrEqual(3000)
      expect(triangles).toBeLessThanOrEqual(4000)
    } finally {
      geometry.dispose()
    }
  })
  test('the noir pot stays within its triangle budget, including soil and brass hardware', () => {
    const geometry = new PotGeometry('noir')
    try {
      expect(geometry.trim).not.toBeNull()
      const triangles = triangleCount(geometry.shell) + triangleCount(geometry.soil) + triangleCount(geometry.trim)
      expect(triangles).toBeGreaterThanOrEqual(2500)
      expect(triangles).toBeLessThanOrEqual(3000)
    } finally {
      geometry.dispose()
    }
  })
  test('all eight plants are deterministic, rooted, finite and individually modeled', () => {
    const hashes = new Set<bigint | number>
    for (const plant of plants) {
      const geometry = new PlantGeometry(plant.id)
      const repeat = new PlantGeometry(plant.id)
      try {
        hashes.add(Bun.hash(geometry.foliage.getAttribute('position').array))
        expect(geometry.foliage.getAttribute('position').array).toEqual(repeat.foliage.getAttribute('position').array)
        expect(geometry.stems.boundingBox!.min.y).toBeLessThan(0)
        expect(geometry.foliage.boundingBox!.max.y).toBeGreaterThan(0.4)
        for (const part of [geometry.foliage, geometry.stems]) {
          for (const name of ['position', 'normal', 'uv']) {
            expect([...part.getAttribute(name).array].every(Number.isFinite)).toBe(true)
          }
          expect(part.index).not.toBeNull()
          expect(part.index!.count % 3).toBe(0)
          expect([...part.index!.array].every(index => index < part.getAttribute('position').count)).toBe(true)
          expect(part.getAttribute('position').count).toBeGreaterThan(0)
        }
        expect(geometry.foliage.getAttribute('color').count).toBe(geometry.foliage.getAttribute('position').count)
        // Roots stay inside even the narrowest vessel, never floating above its soil.
        const roots = geometry.stems.getAttribute('position')
        for (let i = 0; i < roots.count; i++) {
          if (roots.getY(i) <= 0) {
            expect(Math.hypot(roots.getX(i), roots.getZ(i))).toBeLessThan(0.25)
          }
        }
      } finally {
        geometry.dispose()
        repeat.dispose()
      }
    }
    expect(hashes.size).toBe(8)
  })
})
describe('plant sign complexity', () => {
  test('indexed and merged nonindexed meshes count triangles, not vertices', () => {
    const indexed = new BoxGeometry
    const nonindexed = indexed.toNonIndexed()
    const empty = new BufferGeometry
    try {
      expect(triangleCount(indexed)).toBe(12)
      expect(triangleCount(nonindexed)).toBe(12)
      expect(triangleCount(empty)).toBe(0)
      expect(triangleCount(null)).toBe(0)
    } finally {
      indexed.dispose()
      nonindexed.dispose()
      empty.dispose()
    }
  })
})
