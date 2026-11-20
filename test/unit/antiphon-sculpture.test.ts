import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {triangleCount} from '../../src/lib/geometry.ts'
import AntiphonGeometry from '../../src/sculptures/antiphon/AntiphonGeometry.ts'
import {createSculpture} from '../../src/sculptures/index.ts'

const entry = createSculpture('antiphon')
const stone = new AntiphonGeometry
const material = new MeshBasicMaterial
const model = new Mesh(stone, material)
afterAll(() => {
  stone.dispose()
  material.dispose()
})
test('Antiphon’s mesh fits its catalog dimensions to the centimeter and stays within the triangle budget', () => {
  expect(triangleCount(stone)).toBeLessThanOrEqual(32_768)
  stone.computeBoundingBox()
  expect(stone.boundingBox!.min.y).toBe(0)
  const size = stone.boundingBox!.getSize(new Vector3).toArray()
  for (const [axis, length] of size.entries()) {
    expect(length).toBeCloseTo(entry.size[axis], 2)
  }
  // Signed tetrahedral volumes: the surface faces out and the bores subtract air rather than adding more stone.
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
test('Antiphon stands on its heel without tipping and its collision leaves the loop and both bells open', async () => {
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
    expect(probe(new Vector3(0, 1, 1), new Vector3(0, 0, -1))).toBeUndefined()
    expect(probe(new Vector3(0.71, 1, 1), new Vector3(0, 0, -1))).toBeLessThan(1)
    // Inward from the mouth of each bell, not just to the outside of its rim.
    expect(probe(new Vector3(-0.91, 2.65, 0.67), new Vector3(0.5, -0.22, -0.25))).toBeGreaterThan(0.9)
    expect(probe(new Vector3(0.51, 3.48, 0.19), new Vector3(0.01, -0.35, -0.28))).toBeGreaterThan(0.9)
  } finally {
    world.free()
  }
})
