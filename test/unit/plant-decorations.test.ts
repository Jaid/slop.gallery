import {describe, expect, test} from 'bun:test'

import {BoxGeometry, BufferGeometry, Mesh, MeshBasicNodeMaterial, Raycaster, Vector3} from 'three/webgpu'

import {plantCombinations, plants, pots} from '../../src/lib/gallery/plantDecorations/catalog.ts'
import {complexityLabel, decorationComplexity} from '../../src/lib/gallery/plantDecorations/complexity.ts'
import PlantGeometry from '../../src/lib/gallery/plantDecorations/PlantGeometry.ts'
import PotGeometry from '../../src/lib/gallery/plantDecorations/PotGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'

describe('modular botanical catalog', () => {
  test('every vessel and every botanical pair up exactly once, numbered from 1, pot by pot', () => {
    const potIds = new Set(pots.map(pot => pot.id))
    expect(potIds.size).toBe(pots.length)
    const plantIds = new Set(plants.map(plant => plant.id))
    expect(plantIds.size).toBe(plants.length)
    const pairs = pots.length * plants.length
    expect(plantCombinations.map(combination => combination.number)).toEqual(Array.from({length: pairs}, (_, i) => i + 1))
    const potPlantPairs = new Set(plantCombinations.map(combination => `${combination.pot}:${combination.plant}`))
    expect(potPlantPairs.size).toBe(pairs)
    for (const [row, pot] of pots.entries()) {
      const potCombinations = plantCombinations.slice(row * plants.length, (row + 1) * plants.length)
      expect(potCombinations.map(combination => combination.plant)).toEqual(plants.map(plant => plant.id))
      expect(potCombinations.every(combination => combination.pot === pot.id)).toBe(true)
    }
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
  test('pot 01 stays within its triangle budget, including soil', () => {
    const geometry = new PotGeometry(plantCombinations[0].pot)
    try {
      const triangles = triangleCount(geometry.shell) + triangleCount(geometry.soil) + triangleCount(geometry.trim)
      expect(triangles).toBeGreaterThanOrEqual(2500)
      expect(triangles).toBeLessThanOrEqual(3000)
    } finally {
      geometry.dispose()
    }
  })
  test('pot 09 stays within its triangle budget and retains all 40 evenly spaced flutes', () => {
    const geometry = new PotGeometry(plantCombinations[8].pot)
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
  test('pot 17 stays within its triangle budget, including soil', () => {
    const geometry = new PotGeometry(plantCombinations[16].pot)
    try {
      const triangles = triangleCount(geometry.shell) + triangleCount(geometry.soil) + triangleCount(geometry.trim)
      expect(triangles).toBeGreaterThanOrEqual(3000)
      expect(triangles).toBeLessThanOrEqual(4000)
    } finally {
      geometry.dispose()
    }
  })
  test('pot 25 stays within its triangle budget, including soil and brass hardware', () => {
    const geometry = new PotGeometry(plantCombinations[24].pot)
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
  test('every label includes the plant, vessel, soil and optional brass hardware exactly once', () => {
    const plantGeometry = new Map(plants.map(plant => [plant.id, new PlantGeometry(plant.id)]))
    const potGeometry = new Map(pots.map(pot => [pot.id, new PotGeometry(pot.id)]))
    try {
      for (const combination of plantCombinations) {
        const pot = potGeometry.get(combination.pot)!
        const plant = plantGeometry.get(combination.plant)!
        const counts = decorationComplexity(pot, plant)
        expect(counts.plantTriangles).toBe((plant.foliage.index!.count + plant.stems.index!.count) / 3)
        expect(counts.potTriangles).toBe((pot.shell.index!.count + pot.soil.index!.count) / 3 + triangleCount(pot.trim))
        expect(counts.triangles).toBe(counts.potTriangles + counts.plantTriangles)
        expect(Number.isSafeInteger(counts.triangles)).toBe(true)
        expect(counts.potTriangles).toBeGreaterThan(triangleCount(pot.shell))
        if (pot.trim) {
          expect(counts.potTriangles).toBeGreaterThan(triangleCount(pot.shell) + triangleCount(pot.soil))
        }
      }
    } finally {
      for (const geometry of [...plantGeometry.values(), ...potGeometry.values()]) {
        geometry.dispose()
      }
    }
  })
  test('sign text splits pot and plant triangles in that order and groups each count independently', () => {
    expect(complexityLabel({
      potTriangles: 9999,
      plantTriangles: 10_000,
      triangles: 19_999,
    })).toBe('Complexity: 9999 + 10 000 triangles')
    expect(complexityLabel({
      potTriangles: 123_456,
      plantTriangles: 9999,
      triangles: 133_455,
    })).toBe('Complexity: 123 456 + 9999 triangles')
    expect(complexityLabel({
      potTriangles: 0,
      plantTriangles: 0,
      triangles: 0,
    })).toBe('Complexity: 0 + 0 triangles')
  })
})
