import {describe, expect, test} from 'bun:test'

import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import {MeshPhysicalNodeMaterial, Vector3} from 'three/webgpu'

import {moonfallCrater} from '../../src/lib/gallery/moonfall/config.ts'
import {fenceShape} from '../../src/lib/gallery/moonfall/fence.ts'
import {stanchionHeight} from '../../src/lib/gallery/railings/stanchion.ts'
import StanchionRingGeometry from '../../src/lib/gallery/railings/StanchionRingGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import gold from '../../src/lib/materials/gold.ts'
import GoldMaterial, {goldReflectance} from '../../src/lib/materials/GoldMaterial.ts'
import VelvetRopeMaterial from '../../src/lib/materials/VelvetRopeMaterial.ts'

describe('gold', () => {
  test('is a lacquered, fully metallic and procedurally varied physical material', () => {
    const material = new GoldMaterial
    try {
      expect(material).toBeInstanceOf(MeshPhysicalNodeMaterial)
      expect(material.metalness).toBe(1)
      expect(material.roughness).toBeLessThan(0.25)
      expect(material.clearcoat).toBeGreaterThan(0)
      expect(material.clearcoatRoughness).toBeLessThan(0.1)
      expect(material.colorNode).not.toBeNull()
      expect(material.roughnessNode).not.toBeNull()
      expect(material.clearcoatRoughnessNode).not.toBeNull()
      // Without an environment of its own it mirrors the scene’s.
      expect(material.envMap).toBeNull()
    } finally {
      material.dispose()
    }
  })
  test('reflects warm gold: strongest in red, weakest in blue', () => {
    const [red, green, blue] = goldReflectance
    expect(red).toBe(1)
    expect(green).toBeLessThan(red)
    expect(blue).toBeLessThan(green / 2)
  })
  test('the gallery shares one instance that mirrors its own studio', () => {
    expect(gold).toBeInstanceOf(GoldMaterial)
    expect(gold.envMap).toBeInstanceOf(StudioEnvironment)
    expect(gold.envMapIntensity).toBeGreaterThan(0)
  })
})
describe('the stanchion barrier', () => {
  test('its rope is braided garnet velvet', () => {
    const velvet = new VelvetRopeMaterial
    try {
      expect(velvet).toBeInstanceOf(MeshPhysicalNodeMaterial)
      expect(velvet.metalness).toBe(0)
      expect(velvet.roughness).toBeGreaterThan(0.8)
      expect(velvet.sheen).toBeGreaterThan(0)
      expect(velvet.colorNode).not.toBeNull()
      expect(velvet.sheenNode).not.toBeNull()
      expect(velvet.normalNode).not.toBeNull()
    } finally {
      velvet.dispose()
    }
  })
  test('finely turned posts for polished metal, with coarse stand-ins of the same size for collision', () => {
    // the most posts the seed can draw
    const fence = new StanchionRingGeometry(moonfallCrater.fenceRadius, moonfallCrater.fencePosts[1], fenceShape(moonfallCrater.fencePosts[1]))
    try {
      const posts = triangleCount(fence.posts)
      const collision = triangleCount(fence.postCollision)
      expect(collision).toBeLessThan(posts / 2)
      expect(posts).toBeLessThan(80_000)
      expect(collision).toBeLessThan(20_000)
      for (const part of [fence.posts, fence.postCollision, fence.rope]) {
        expect(part.index).not.toBeNull()
        for (const attribute of Object.values(part.attributes)) {
          expect([...attribute.array].every(Number.isFinite)).toBe(true)
        }
      }
      const normals = fence.posts.getAttribute('normal')
      const normal = new Vector3
      for (let i = 0; i < normals.count; i++) {
        expect(normal.fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 4)
      }
      fence.posts.computeBoundingBox()
      fence.postCollision.computeBoundingBox()
      const render = fence.posts.boundingBox!
      const stand = fence.postCollision.boundingBox!
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(Math.abs(render.min[axis] - stand.min[axis])).toBeLessThan(0.02)
        expect(Math.abs(render.max[axis] - stand.max[axis])).toBeLessThan(0.02)
      }
      // Braid repeats run past one turn by arc length, then return to 0 at the seam.
      const ropeUv = fence.rope.getAttribute('uv')
      const braidU = ropeUv.array.filter((_, i) => i % 2 === 0)
      expect(ropeUv.getX(0)).toBe(0)
      expect(Math.max(...braidU)).toBeGreaterThan(100)
      // Every post stands on the floor with its finial at rope height.
      const size = render.getSize(new Vector3)
      expect(render.min.y).toBeCloseTo(0, 6)
      expect(size.y).toBeCloseTo(stanchionHeight, 4)
      fence.rope.computeBoundingBox()
      expect(fence.rope.boundingBox!.max.y).toBeLessThan(render.max.y)
    } finally {
      fence.dispose()
    }
  })
})
