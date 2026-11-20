import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {MeshBVH} from 'three-mesh-bvh'
import {Box3, Line3, Matrix4, Ray, Vector3} from 'three/webgpu'

import {salonSculptureSocket} from '../../src/lib/gallery/salon.ts'
import {salonSculptureSpot} from '../../src/lib/gallery/salonSculpture.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import CounterflowGeometry from '../../src/sculptures/counterflow/CounterflowGeometry.ts'
import CounterflowSculpture from '../../src/sculptures/counterflow/CounterflowSculpture.ts'

const geometry = new CounterflowGeometry
const sculpture = new CounterflowSculpture
const meshes = [geometry.ribbon, geometry.foot]
const ribbonTree = new MeshBVH(geometry.ribbon, {indirect: true})
afterAll(() => geometry.dispose())
test('Counterflow fits its catalog envelope and its combined mesh stays within the triangle budget', () => {
  expect(triangleCount(geometry.ribbon) + triangleCount(geometry.foot)).toBeLessThanOrEqual(32_768)
  const [width, height, depth] = sculpture.size
  const envelope = new Box3(new Vector3(-width / 2, 0, -depth / 2), new Vector3(width / 2, height, depth / 2))
  for (const mesh of meshes) {
    mesh.computeBoundingBox()
    expect(envelope.containsBox(mesh.boundingBox!)).toBe(true)
  }
  expect(geometry.foot.boundingBox!.min.y).toBe(0)
  expect(geometry.ribbon.boundingBox!.min.y).toBeLessThan(geometry.foot.boundingBox!.max.y)
})
test('the ribbon sweeps through the tight turns without crossing itself', () => {
  const index = geometry.ribbon.index!
  const corners = (id: number) => {
    const start = ribbonTree.resolveTriangleIndex(id) * 3
    return [index.getX(start), index.getX(start + 1), index.getX(start + 2)]
  }
  const edge = new Line3
  const crossesItself = ribbonTree.bvhcast(ribbonTree, new Matrix4, {
    intersectsTriangles(a, b, i, j) {
      if (i >= j) {
        return false
      }
      const other = corners(j)
      return !corners(i).some(vertex => other.includes(vertex)) && a.intersectsTriangle(b, edge) && edge.distance() > 1e-6
    },
  })
  expect(crossesItself).toBe(false)
})
await RAPIER.init()
function mountCounterflow(world: RAPIER.World, position = new Vector3) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z))
  const colliders = geometry.colliders.map(({vertices, massFraction}) => {
    const shape = RAPIER.ColliderDesc.convexHull(vertices)
    if (!shape) {
      throw new Error('Counterflow produced a degenerate hull.')
    }
    return world.createCollider(shape.setMass(massFraction * sculpture.mass), body)
  })
  return {
    body,
    colliders,
  }
}
test('the collider leaves the eye open and meets the visible stone on either side', () => {
  const world = new RAPIER.World({
    x: 0,
    y: 0,
    z: 0,
  })
  try {
    const {colliders} = mountCounterflow(world)
    // Test across the face that looks toward the Salon’s approach.
    const angle = -24 * Math.PI / 180
    const axis = new Vector3(0, 1, 0)
    const toward = new Vector3(0, 0, -1)
    toward.applyAxisAngle(axis, angle)
    const rayAt = (x: number, y: number) => {
      const start = new Vector3(x, y, 4)
      start.applyAxisAngle(axis, angle)
      const ray = new RAPIER.Ray(start, toward)
      const distances = colliders.map(collider => collider.castRay(ray, 8, true)).filter(distance => distance >= 0)
      const mesh = ribbonTree.raycastFirst(new Ray(start, toward))
      return {
        physics: Math.min(...distances),
        mesh,
      }
    }
    for (const y of [0.9, 1.5, 2.3]) {
      expect(rayAt(0, y)).toEqual({
        physics: Infinity,
        mesh: null,
      })
    }
    for (const [x, y] of [[-1, 1.5], [0.8, 1.5], [0.1, 3.09]]) {
      const {mesh, physics} = rayAt(x, y)
      expect(mesh).not.toBeNull()
      expect(Math.abs(physics - mesh!.distance)).toBeLessThan(0.08)
    }
  } finally {
    world.free()
  }
})
test.each([30, 60, 120])('Counterflow settles on its Salon socket at %i Hz without sliding away', hz => {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  try {
    world.timestep = 1 / hz
    const [x, y, z] = salonSculptureSocket.position
    const [width, height, depth] = salonSculptureSocket.size
    world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(x, y + height / 2, z))
    const start = new Vector3(...salonSculptureSpot)
    const {body} = mountCounterflow(world, start)
    expect(Math.abs(body.mass() - sculpture.mass)).toBeLessThan(0.01)
    for (let i = 0; i < hz * 6; i++) {
      world.step()
    }
    expect(start.distanceTo(body.translation())).toBeLessThan(0.02)
    expect(body.rotation().w).toBeGreaterThan(0.999)
    expect(body.isSleeping()).toBe(true)
  } finally {
    world.free()
  }
})
