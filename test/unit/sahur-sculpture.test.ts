import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {triangleCount} from '../../src/lib/geometry.ts'
import {createSculpture} from '../../src/sculptures/index.ts'
import SahurGeometry from '../../src/sculptures/sahur/SahurGeometry.ts'

const entry = createSculpture('sahur')
const stone = new SahurGeometry
const material = new MeshBasicMaterial
const model = new Mesh(stone, material)
afterAll(() => {
  stone.dispose()
  material.dispose()
})
test('Tung Tung Tung Sahur’s mesh fits its catalog dimensions to the centimeter and stays within the triangle budget', () => {
  expect(triangleCount(stone)).toBeLessThanOrEqual(32_768)
  stone.computeBoundingBox()
  expect(stone.boundingBox!.min.y).toBe(0)
  const size = stone.boundingBox!.getSize(new Vector3).toArray()
  for (const [axis, length] of size.entries()) {
    expect(length).toBeCloseTo(entry.size[axis], 2)
  }
  // Signed tetrahedral volume: every closed component faces outward and matches the catalog stone mass.
  const points = stone.getAttribute('position')
  const {array: index} = stone.index!
  const [a, b, c] = [new Vector3, new Vector3, new Vector3]
  let volume = 0
  for (let i = 0; i < index.length; i += 3) {
    a.fromBufferAttribute(points, index[i])
    b.fromBufferAttribute(points, index[i + 1])
    c.fromBufferAttribute(points, index[i + 2])
    volume += a.dot(b.cross(c)) / 6
  }
  expect(Math.abs(2500 * volume - entry.mass)).toBeLessThan(0.01 * entry.mass)
})
test('Tung Tung Tung Sahur stands steadily on his feet and bat and leaves gaps between his legs and bat open', async () => {
  await RAPIER.init()
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 0.15, 1.6).setTranslation(0, -0.15, 0))
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    for (const {points, share} of stone.hulls) {
      world.createCollider(RAPIER.ColliderDesc.convexHull(points)!.setMass(entry.mass * share), body)
    }
    for (let i = 0; i < 240; i++) {
      world.step()
    }
    expect(body.mass()).toBeCloseTo(entry.mass, 1)
    const {x, y, z} = body.translation()
    expect(Math.hypot(x, y, z)).toBeLessThan(0.005)
    expect(Math.abs(body.rotation().w)).toBeCloseTo(1, 5)
    const probe = (origin: Vector3, direction: Vector3) => {
      direction.normalize()
      const ray = new Raycaster(origin, direction, 0, 3)
      const stoneHit = ray.intersectObject(model).at(0)
      const hit = world.castRay(new RAPIER.Ray(origin, direction), 3, true)
      if (!stoneHit) {
        expect(hit).toBeNull()
        return
      }
      expect(Math.abs(hit!.timeOfImpact - stoneHit.distance)).toBeLessThan(0.06)
      return stoneHit.distance
    }
    // Open gap between the legs and between the leaning bat and right leg.
    expect(probe(new Vector3(0.18, 0.85, 1), new Vector3(0, 0, -1))).toBeUndefined()
    expect(probe(new Vector3(-0.45, 0.55, 1), new Vector3(0, 0, -1))).toBeUndefined()
    // Solid log torso and solid bat barrel match between visual geometry and Rapier hulls.
    expect(probe(new Vector3(0.18, 2.1, 1), new Vector3(0, 0, -1))).toBeLessThan(1)
    expect(probe(new Vector3(-0.92, 0.55, 1), new Vector3(0, 0, -1))).toBeLessThan(1.2)
  } finally {
    world.free()
  }
})
