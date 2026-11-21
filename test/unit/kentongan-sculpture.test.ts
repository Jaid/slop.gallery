import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {triangleCount} from '../../src/lib/geometry.ts'
import {createSculpture} from '../../src/sculptures/index.ts'
import KentonganGeometry, {kentonganDrum, stoneDensity} from '../../src/sculptures/kentongan/KentonganGeometry.ts'

const entry = createSculpture('kentongan')
const stone = new KentonganGeometry
const material = new MeshBasicMaterial
const model = new Mesh(stone, material)
afterAll(() => {
  stone.dispose()
  material.dispose()
})
test('Kentongan’s mesh fits its catalog dimensions to the centimeter, stays within the triangle budget and weighs what its stone does', () => {
  expect(triangleCount(stone)).toBeLessThanOrEqual(32_768)
  stone.computeBoundingBox()
  expect(stone.boundingBox!.min.y).toBe(0)
  const size = stone.boundingBox!.getSize(new Vector3).toArray()
  for (const [axis, length] of size.entries()) {
    expect(length).toBeCloseTo(entry.size[axis], 1)
    expect(Math.abs(length - entry.size[axis])).toBeLessThan(0.01)
  }
  // Every part is closed and faces out, so their signed volumes add up to stone rather than cancelling.
  expect(stone.volume).toBeGreaterThan(0)
  expect(Math.abs(stoneDensity * stone.volume - entry.mass)).toBeLessThan(0.01 * entry.mass)
  const shares = stone.hulls.reduce((sum, hull) => sum + hull.share, 0)
  expect(shares).toBeCloseTo(1, 6)
  expect(stone.hulls.every(hull => hull.share >= 0)).toBe(true)
})
test('Kentongan stands on its base without tipping, and its colliders follow the drum, the slot and the gap between the legs', async () => {
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
      expect(hit).not.toBeNull()
      expect(Math.abs(hit!.timeOfImpact - stoneHit.distance)).toBeLessThan(0.06)
      return stoneHit.distance
    }
    // between the legs, under the drum
    expect(probe(new Vector3(0, 0.8, 1), new Vector3(0, 0, -1))).toBeUndefined()
    // the drum’s flank, beside the face
    expect(probe(new Vector3(-1, 2.7, 0), new Vector3(1, 0, 0))).toBeCloseTo(1 - kentonganDrum.radius, 1)
    // past the beater, onto the back of the drum
    expect(probe(new Vector3(0, 2.6, -1), new Vector3(0, 0, 1))).toBeLessThan(1)
  } finally {
    world.free()
  }
})
