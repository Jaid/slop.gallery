import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {salonSculptureSocket} from '../../src/lib/gallery/salon.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {createSculpture} from '../../src/sculptures/index.ts'
import carvingGeometry from '../../src/sculptures/tung_tung_tung_sahur/carvingGeometry.ts'

const entry = createSculpture('tung_tung_tung_sahur')
const {geometry, hulls} = carvingGeometry()
const material = new MeshBasicMaterial
const mesh = new Mesh(geometry, material)
afterAll(() => {
  geometry.dispose()
  material.dispose()
})
test('the entire Sahur carving, including the beater, fits the socket and triangle budget', () => {
  expect(triangleCount(geometry)).toBeLessThanOrEqual(32_768)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  expect(box.min.y).toBe(0)
  const size = box.getSize(new Vector3).toArray()
  for (const [axis, measure] of size.entries()) {
    expect(measure).toBeCloseTo(entry.size[axis], 2)
  }
  const [w, , d] = salonSculptureSocket.size
  expect(Math.max(-box.min.x, box.max.x)).toBeLessThan(w / 2)
  expect(Math.max(-box.min.z, box.max.z)).toBeLessThan(d / 2)
})
test('the eyelid inlays and tapered lofts close without flipped seams or collapsed triangles', () => {
  const positions = geometry.getAttribute('position')
  const indices = geometry.index!.array
  const edges = new Map<number, number>
  const [a, b, c] = [new Vector3, new Vector3, new Vector3]
  let minArea = Infinity
  for (let i = 0; i < indices.length; i += 3) {
    a.fromBufferAttribute(positions, indices[i])
    b.fromBufferAttribute(positions, indices[i + 1]).sub(a)
    c.fromBufferAttribute(positions, indices[i + 2]).sub(a)
    minArea = Math.min(minArea, b.cross(c).lengthSq())
    for (let j = 0; j < 3; j++) {
      const from = indices[i + j]
      const to = indices[i + (j + 1) % 3]
      const key = Math.min(from, to) * positions.count + Math.max(from, to)
      edges.set(key, (edges.get(key) ?? 0) + (to > from ? 1 : -1))
    }
  }
  expect(minArea).toBeGreaterThan(0)
  expect(edges.values().every(balance => balance === 0)).toBe(true)
})
test('Sahur balances on bare feet and has separate physical limbs and beater', async () => {
  await RAPIER.init()
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 0.15, 1.6).setTranslation(0, -0.15, 0))
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    for (const {points, share} of hulls) {
      world.createCollider(RAPIER.ColliderDesc.convexHull(points)!.setMass(entry.mass * share), body)
    }
    for (let i = 0; i < 240; i++) {
      world.step()
    }
    expect(body.mass()).toBeCloseTo(entry.mass, 1)
    const {x, y, z} = body.translation()
    expect(Math.hypot(x, y, z)).toBeLessThan(0.005)
    expect(Math.abs(body.rotation().w)).toBeCloseTo(1, 5)
    const forward = new Vector3(0, 0, -1)
    const probe = (across: number, height: number) => {
      const from = new Vector3(across, height, 1)
      const ray = new Raycaster(from, forward, 0, 2)
      const seen = ray.intersectObject(mesh).at(0)?.distance
      const touch = world.castRay(new RAPIER.Ray(from, forward), 2, true)?.timeOfImpact
      if (seen === undefined) {
        expect(touch).toBeUndefined()
      } else {
        expect(touch).toBeDefined()
        expect(Math.abs(touch! - seen)).toBeLessThan(0.06)
      }
      return seen
    }
    expect(probe(0, 0.7)).toBeUndefined() // between the legs
    expect(probe(-0.6, 0.7)).toBeUndefined() // between the beater and the right knee
    expect(probe(0.465, 2.09)).toBeUndefined() // under the left elbow
    expect(probe(0.19, 0.7)).toBeDefined() // calf
    expect(probe(-0.88, 0.7)).toBeDefined() // beater
    expect(probe(0, 3.1)).toBeDefined() // tip of the nose
  } finally {
    world.free()
  }
})
