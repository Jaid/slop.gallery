import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Triangle, Vector3} from 'three/webgpu'

import {colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import OrbHolderGeometry, {orbSeat} from '../../src/lib/gallery/OrbHolderGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {orbRadius} from '../../src/orbs/index.ts'

await RAPIER.init()
/** Where an orb let down onto the holder from just over its seat, pushed by `velocity`, comes to rest after `seconds`, and how low it went on the way. */
function settle(geometry: OrbHolderGeometry, velocity: readonly [number, number, number], seconds = 6) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 120
  try {
    const holder = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry.collision)), holder)
    const orb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, orbSeat + 0.002, 0).setLinvel(...velocity))
    world.createCollider(RAPIER.ColliderDesc.ball(orbRadius), orb)
    let lowest = Infinity
    for (let step = 0; step < seconds * 120; step++) {
      world.step()
      lowest = Math.min(lowest, orb.translation().y)
    }
    const {x, y, z} = orb.translation()
    return {
      lowest,
      position: [x, y, z],
    }
  } finally {
    world.free()
  }
}
describe('the orb holder', () => {
  test('keeps the complete visible holder below 4096 triangles, including the bowl and all three ornamented feet', () => {
    const geometry = new OrbHolderGeometry
    try {
      expect(triangleCount(geometry.metal)).toBeGreaterThan(0)
      expect(triangleCount(geometry.metal)).toBeLessThan(4096)
      // Collision is independent of the visible mesh’s tessellation.
      expect(triangleCount(geometry.collision)).toBe(2784)
      expect(geometry.metal.groups).toHaveLength(0)
    } finally {
      geometry.dispose()
    }
  })
  test('has finite unit normals, valid indices and nondegenerate faces consistent with their shading', () => {
    const geometry = new OrbHolderGeometry
    try {
      const mesh = geometry.metal
      const positions = mesh.getAttribute('position')
      const normals = mesh.getAttribute('normal')
      const indices = mesh.getIndex()!
      for (const attribute of Object.values(mesh.attributes)) {
        expect([...attribute.array].every(Number.isFinite)).toBe(true)
      }
      const a = new Vector3
      const b = new Vector3
      const c = new Vector3
      const face = new Vector3
      const normal = new Vector3
      const scratch = new Vector3
      for (let vertex = 0; vertex < normals.count; vertex++) {
        expect(normal.fromBufferAttribute(normals, vertex).length()).toBeCloseTo(1, 5)
      }
      for (let triangle = 0; triangle < indices.count; triangle += 3) {
        const vertices = [indices.getX(triangle), indices.getX(triangle + 1), indices.getX(triangle + 2)]
        expect(vertices.every(vertex => Number.isInteger(vertex) && vertex >= 0 && vertex < positions.count)).toBe(true)
        a.fromBufferAttribute(positions, vertices[0])
        b.fromBufferAttribute(positions, vertices[1])
        c.fromBufferAttribute(positions, vertices[2])
        face.crossVectors(b.sub(a), c.sub(a))
        expect(face.length()).toBeGreaterThan(1e-9)
        normal.set(0, 0, 0)
        for (const vertex of vertices) {
          normal.add(scratch.fromBufferAttribute(normals, vertex))
        }
        expect(face.normalize().dot(normal.normalize())).toBeGreaterThan(0)
      }
    } finally {
      geometry.dispose()
    }
  })
  test('keeps the empty bowl closed and hollow under its rolled rim', () => {
    const geometry = new OrbHolderGeometry
    const material = new MeshBasicMaterial
    try {
      const mesh = new Mesh(geometry.metal, material)
      const ray = new Raycaster
      for (const radius of [0, 0.02, 0.06, 0.085, 0.098]) {
        for (let sample = 0; sample < 48; sample++) {
          const angle = (sample + 0.37) / 48 * Math.PI * 2
          ray.set(new Vector3(Math.sin(angle) * radius, 0.2, Math.cos(angle) * radius), new Vector3(0, -1, 0))
          const hit = ray.intersectObject(mesh)[0]
          expect(hit).toBeDefined()
          expect(hit.point.y).toBeGreaterThanOrEqual(0.073 - 1e-6)
          expect(hit.point.y).toBeLessThan(0.124)
          expect(hit.face!.normal.y).toBeGreaterThan(0)
        }
      }
      // Test the faces, not just their vertices: the rim’s polygon chords can dip slightly inside the ideal ball.
      // Submillimeter contact with the roll is fine, but the cup and ornaments must not visibly penetrate it.
      const triangle = new Triangle
      const closest = new Vector3
      const center = new Vector3(0, orbSeat, 0)
      const positions = geometry.metal.getAttribute('position')
      const indices = geometry.metal.getIndex()!
      for (let index = 0; index < indices.count; index += 3) {
        triangle.a.fromBufferAttribute(positions, indices.getX(index))
        triangle.b.fromBufferAttribute(positions, indices.getX(index + 1))
        triangle.c.fromBufferAttribute(positions, indices.getX(index + 2))
        expect(triangle.closestPointToPoint(center, closest).distanceTo(center)).toBeGreaterThanOrEqual(orbRadius - 0.0003)
      }
    } finally {
      material.dispose()
      geometry.dispose()
    }
  })
  test('presents outward faces on the leaves, feet and base underside', () => {
    const geometry = new OrbHolderGeometry
    const material = new MeshBasicMaterial({side: DoubleSide})
    try {
      const mesh = new Mesh(geometry.metal, material)
      const ray = new Raycaster
      const outside = (origin: Vector3, direction: Vector3) => {
        ray.set(origin, direction)
        const hit = ray.intersectObject(mesh)[0]
        expect(hit).toBeDefined()
        expect(hit.face!.normal.dot(direction)).toBeLessThan(0)
        return hit
      }
      expect(outside(new Vector3(0.002, -0.01, 0), new Vector3(0, 1, 0)).point.y).toBeCloseTo(0.034, 6)
      for (let foot = 0; foot < 3; foot++) {
        const angle = foot / 3 * Math.PI * 2
        const outward = new Vector3(Math.sin(angle), 0, Math.cos(angle))
        const leaf = outside(outward.clone().multiplyScalar(0.17).setY(0.047), outward.clone().negate())
        expect(Math.hypot(leaf.point.x, leaf.point.z)).toBeGreaterThan(0.119)
        outside(outward.clone().multiplyScalar(0.17).setY(0.02), outward.clone().negate())
        expect(outside(outward.clone().multiplyScalar(0.135).setY(-0.01), new Vector3(0, 1, 0)).point.y).toBeCloseTo(0, 6)
      }
    } finally {
      material.dispose()
      geometry.dispose()
    }
  })
  test('retains all sixteen rounded lobes and deep valleys around the cup', () => {
    const geometry = new OrbHolderGeometry
    const material = new MeshBasicMaterial
    try {
      const mesh = new Mesh(geometry.metal, material)
      const ray = new Raycaster
      const radiusAt = (angle: number) => {
        const direction = new Vector3(Math.sin(angle), 0, Math.cos(angle))
        ray.set(direction.clone().multiplyScalar(0.2).setY(0.098), direction.negate())
        const hit = ray.intersectObject(mesh)[0]
        expect(hit).toBeDefined()
        return Math.hypot(hit.point.x, hit.point.z)
      }
      for (let lobe = 0; lobe < 16; lobe++) {
        const crest = radiusAt(lobe / 16 * Math.PI * 2)
        const valley = radiusAt((lobe + 0.5) / 16 * Math.PI * 2)
        expect(crest).toBeGreaterThan(0.115)
        expect(crest - valley).toBeGreaterThan(0.006)
      }
    } finally {
      material.dispose()
      geometry.dispose()
    }
  })
  test('stands on the cap within the pedestal’s footprint, lower than the orb it holds', () => {
    const geometry = new OrbHolderGeometry
    try {
      geometry.metal.computeBoundingBox()
      const {min, max} = geometry.metal.boundingBox!
      expect(min.y).toBeCloseTo(0, 6)
      expect(Math.max(-min.x, max.x, -min.z, max.z)).toBeLessThan(0.58)
      // Its three feet spread wider than the orb, one of them to the front, along +z, which rises out of it by most of its height.
      expect(max.z).toBeGreaterThan(orbRadius)
      expect(-min.z).toBeLessThan(max.z)
      expect(max.x).toBeCloseTo(-min.x, 6)
      expect(max.y).toBeCloseTo(0.1315, 6)
      expect(max.y).toBeLessThan(orbSeat)
      expect(orbSeat - orbRadius).toBeGreaterThan(0.07)
    } finally {
      geometry.dispose()
    }
  })
  test('holds an orb let down onto its lip right where it was let down, and keeps it when it is nudged', () => {
    const geometry = new OrbHolderGeometry
    try {
      for (const velocity of [[0, 0, 0], [0.4, 0, 0.2], [-1.5, 0, 0]] as const) {
        const {lowest, position: [x, y, z]} = settle(geometry, velocity)
        expect(Math.hypot(x, z)).toBeLessThan(0.002)
        expect(y).toBeCloseTo(orbSeat, 2)
        expect(lowest).toBeGreaterThan(orbSeat - 0.002)
      }
    } finally {
      geometry.dispose()
    }
  })
})
