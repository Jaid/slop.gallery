import {describe, expect, test} from 'bun:test'

import {knotGeometryArgs} from 'knot-materials/geometry.ts'
import {MeshBVH} from 'three-mesh-bvh'
import {Box3, Mesh, MeshBasicMaterial, Raycaster, TorusKnotGeometry, Vector3} from 'three/webgpu'

import ChandelierGeometry from '../../src/lib/gallery/ChandelierGeometry.ts'
import {siennaCeilingBeam, siennaCeilingBeamOffsets, siennaCeilingBeamY} from '../../src/lib/gallery/sienna.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {chandelierCanopyTop, chandelierPhysics} from '../../src/lib/physics/chandelier.ts'
import {rooms} from './fixtures/gallery.ts'

describe('chandelier geometry', () => {
  test('the suspended fixture and fixed canopy retain their geometry and triangle budget', () => {
    const geometry = new ChandelierGeometry
    try {
      const parts = [geometry.brass, geometry.candles, geometry.flames, geometry.pendant, geometry.canopy]
      const bounds = new Box3
      let triangles = 0
      let bytes = 0
      for (const part of parts) {
        triangles += triangleCount(part)
        expect(part.index).not.toBeNull()
        bytes += part.index!.array.byteLength
        const positions = part.getAttribute('position')
        expect([...part.index!.array].every(index => index < positions.count)).toBe(true)
        for (const attribute of Object.values(part.attributes)) {
          expect([...attribute.array].every(Number.isFinite)).toBe(true)
          bytes += attribute.array.byteLength
        }
        const normal = new Vector3
        const normals = part.getAttribute('normal')
        for (let i = 0; i < normals.count; i++) {
          expect(normal.fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 5)
        }
        part.computeBoundingBox()
        bounds.union(part.boundingBox!)
      }
      expect(triangles).toBeLessThan(7500)
      expect(bytes).toBeLessThan(240_000)
      // The canopy tops it where its physics say, under the Sienna’s ceiling and high over the visitors’ heads, and the arms reach out evenly all round.
      const sienna = rooms.find(room => room.id === 'sienna')!
      expect(bounds.max.y).toBeCloseTo(chandelierCanopyTop, 5)
      expect(bounds.max.y + chandelierPhysics.height).toBeLessThanOrEqual(sienna.height)
      expect(bounds.min.y + chandelierPhysics.height).toBeGreaterThan(2)
      expect(bounds.max.x).toBeCloseTo(-bounds.min.x, 5)
      expect(bounds.max.z).toBeCloseTo(-bounds.min.z, 5)
    } finally {
      geometry.dispose()
    }
  })
  test('all eight arms end in a saucer, candle and flame', () => {
    const geometry = new ChandelierGeometry
    const material = new MeshBasicMaterial
    try {
      const brass = new Mesh(geometry.brass, material)
      const candles = new Mesh(geometry.candles, material)
      const flames = new Mesh(geometry.flames, material)
      const heights = Array.from({length: 8}, (_, i) => {
        const position = new Vector3(1.25, 2, 0)
        position.applyAxisAngle(new Vector3(0, 1, 0), i * Math.PI / 4)
        const ray = new Raycaster(position, new Vector3(0, -1, 0))
        return [brass, candles, flames].map(part => ray.intersectObject(part)[0].point.y)
      })
      const [saucer, candle, flame] = heights[0]
      expect(saucer).toBeLessThan(candle)
      expect(candle).toBeLessThan(flame)
      for (const arm of heights) {
        for (const [index, height] of arm.entries()) {
          expect(height).toBeCloseTo(heights[0][index], 5)
        }
      }
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
  test('hangs in a clear bay between the Sienna ceiling beams, at rest and while swinging', () => {
    const geometry = new ChandelierGeometry
    try {
      const sienna = rooms.find(room => room.id === 'sienna')!
      const beamBottom = siennaCeilingBeamY(sienna.height) - siennaCeilingBeam.height / 2
      const offsets = siennaCeilingBeamOffsets(sienna.size[0])
      expect(offsets).toHaveLength(siennaCeilingBeam.count)
      // The joists still span the room evenly, with half a bay to each wall.
      expect(offsets[0] + sienna.size[0] / 2).toBeCloseTo((offsets[1] - offsets[0]) / 2, 5)
      const pivot = new Vector3(...chandelierPhysics.anchor)
      const point = new Vector3
      const swingAxis = new Vector3(0, 0, 1)
      let clearance = Infinity
      let checked = 0
      const check = (x: number, y: number) => {
        if (y + chandelierPhysics.height < beamBottom) {
          return
        }
        checked++
        for (const offset of offsets) {
          clearance = Math.min(clearance, Math.abs(x - offset) - siennaCeilingBeam.width / 2)
        }
      }
      const canopy = geometry.canopy.getAttribute('position')
      for (let i = 0; i < canopy.count; i++) {
        point.fromBufferAttribute(canopy, i)
        check(point.x, point.y)
      }
      // The fixture swings about its pivot; the heavy pot in chandelier.test.ts peaks at about 26°.
      for (const geometryPart of [geometry.brass, geometry.candles, geometry.flames, geometry.pendant]) {
        const positions = geometryPart.getAttribute('position')
        for (const tilt of [-30, -20, -10, 0, 10, 20, 30]) {
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).sub(pivot).applyAxisAngle(swingAxis, tilt * Math.PI / 180).add(pivot)
            check(point.x, point.y)
          }
        }
      }
      // The canopy and the top of the stem reach above the beams’ underside.
      expect(checked).toBeGreaterThan(0)
      expect(clearance).toBeGreaterThan(0.5)
    } finally {
      geometry.dispose()
    }
  })
  test('releases all five owned geometries', () => {
    const geometry = new ChandelierGeometry
    let disposed = 0
    for (const part of [geometry.brass, geometry.candles, geometry.flames, geometry.pendant, geometry.canopy]) {
      part.addEventListener('dispose', () => disposed++)
    }
    geometry.dispose()
    expect(disposed).toBe(5)
  })
})
describe('gold knot tessellation', () => {
  test('retains the winding and stays within 4 mm of the original surface in both directions', () => {
    const original = new TorusKnotGeometry(0.45, 0.13, 256, 48, 2, 3)
    const optimized = new TorusKnotGeometry(...knotGeometryArgs)
    try {
      expect(optimized.parameters.radius).toBe(original.parameters.radius)
      expect(optimized.parameters.tube).toBe(original.parameters.tube)
      expect(optimized.parameters.p).toBe(original.parameters.p)
      expect(optimized.parameters.q).toBe(original.parameters.q)
      expect(triangleCount(optimized)).toBeLessThanOrEqual(32_768)
      for (const [from, to] of [[original, optimized], [optimized, original]] as const) {
        const bvh = new MeshBVH(to)
        const point = new Vector3
        const positions = from.getAttribute('position')
        let maximum = 0
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i)
          maximum = Math.max(maximum, bvh.closestPointToPoint(point)!.distance)
        }
        expect(maximum).toBeLessThan(0.004)
      }
    } finally {
      original.dispose()
      optimized.dispose()
    }
  })
})
