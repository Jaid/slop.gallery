import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {triangleCount} from '../../src/lib/geometry.ts'
import {createSculpture} from '../../src/sculptures/index.ts'
import TungTungTungSahurGeometry from '../../src/sculptures/tung_tung_tung_sahur/TungTungTungSahurGeometry.ts'

const entry = createSculpture('tung_tung_tung_sahur')
const carving = new TungTungTungSahurGeometry
const material = new MeshBasicMaterial
const model = new Mesh(carving, material)
afterAll(() => {
  carving.dispose()
  material.dispose()
})
test('Sahur’s indexed mesh and finish fit the catalog dimensions and triangle budget', () => {
  expect(carving.index).not.toBeNull()
  expect(triangleCount(carving)).toBeLessThanOrEqual(32_768)
  carving.computeBoundingBox()
  const bounds = carving.boundingBox!
  expect(bounds.min.y).toBe(0)
  for (const [axis, size] of bounds.getSize(new Vector3).toArray().entries()) {
    expect(size).toBeCloseTo(entry.size[axis], 2)
  }
  const positions = carving.getAttribute('position')
  const {array: indices} = carving.index!
  const [a, b, c] = [new Vector3, new Vector3, new Vector3]
  let minAreaSquared = Infinity
  for (let i = 0; i < indices.length; i += 3) {
    a.fromBufferAttribute(positions, indices[i])
    b.fromBufferAttribute(positions, indices[i + 1])
    c.fromBufferAttribute(positions, indices[i + 2])
    minAreaSquared = Math.min(minAreaSquared, b.sub(a).cross(c.sub(a)).lengthSq())
  }
  expect(minAreaSquared).toBeGreaterThan(0)
  for (const attribute of ['normal', 'color', 'sahurGrain', 'sahurEnamel']) {
    const buffer = carving.getAttribute(attribute)
    expect(buffer.count).toBe(positions.count)
    expect(buffer.array.every(Number.isFinite)).toBe(true)
  }
})
test('Sahur balances on the socket and the compound collider leaves the silhouette’s gaps open', async () => {
  await RAPIER.init()
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 0.15, 1.6).setTranslation(0, -0.15, 0))
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    for (const {points, share} of carving.hulls) {
      const hull = RAPIER.ColliderDesc.convexHull(points)
      expect(hull).not.toBeNull()
      world.createCollider(hull!.setMass(entry.mass * share), body)
    }
    for (let step = 0; step < 240; step++) {
      world.step()
    }
    expect(body.mass()).toBeCloseTo(entry.mass, 1)
    const position = body.translation()
    expect(Math.hypot(position.x, position.y, position.z)).toBeLessThan(0.005)
    expect(Math.abs(body.rotation().w)).toBeCloseTo(1, 5)
    const direction = new Vector3(0, 0, -1)
    const probe = (x: number, y: number) => {
      const origin = new Vector3(x, y, 1.5)
      const ray = new Raycaster(origin, direction, 0, 3)
      const visible = ray.intersectObject(model).at(0)?.distance
      const physical = world.castRay(new RAPIER.Ray(origin, direction), 3, true)?.timeOfImpact
      return {
        visible,
        physical,
      }
    }
    // Open air between the legs, between the bat and the shin and between the arm and the waist.
    for (const [x, y] of [[0, 0.9], [-0.5, 0.9], [0.398, 1.91]]) {
      const {visible, physical} = probe(x, y)
      expect(visible).toBeUndefined()
      expect(physical).toBeUndefined()
    }
    // The separate parts still take hits: bat, shin, arm, waist, face and instep.
    for (const [x, y] of [[-0.7, 0.9], [-0.195, 0.9], [0.487, 1.91], [0, 2], [0, 2.88], [0.2, 0.09]]) {
      const {visible, physical} = probe(x, y)
      expect(visible).toBeDefined()
      expect(physical).toBeDefined()
      expect(Math.abs(visible! - physical!)).toBeLessThan(0.06)
    }
  } finally {
    world.free()
  }
})
