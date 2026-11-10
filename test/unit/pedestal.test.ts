import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import PedestalGeometry, {pedestalHeight, pedestalScale} from '../../src/lib/gallery/PedestalGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import LimestoneMaterial from '../../src/lib/materials/LimestoneMaterial.ts'
import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import PropPlacement from '../../src/lib/physics/PropPlacement.ts'

await RAPIER.init()
let geometry: PedestalGeometry
let world: RAPIER.World
const material = new MeshBasicMaterial
/** how far the cap reaches out from the pedestal’s axis */
const capReach = 1.16 / 2 * pedestalScale
beforeEach(() => {
  geometry = new PedestalGeometry
  world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  for (const [vertices, indices] of geometry.collision) {
    world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices))
  }
  world.step()
})
afterEach(() => {
  geometry.dispose()
  world.free()
})
describe('sculpture pedestals', () => {
  test('keeps the support height and footprint with finite, bounded geometry', () => {
    const bounds = geometry.stone.boundingBox!
    expect(bounds.min.y).toBeCloseTo(0, 6)
    expect(bounds.max.y).toBeCloseTo(pedestalHeight, 6)
    expect(bounds.getSize(new Vector3).x).toBeCloseTo(1.16 * pedestalScale, 6)
    expect(bounds.getSize(new Vector3).z).toBeCloseTo(1.16 * pedestalScale, 6)
    let triangles = 0
    let bytes = 0
    for (const part of [geometry.stone, geometry.bronze, geometry.reveals]) {
      for (const attribute of ['position', 'normal', 'uv']) {
        expect([...part.getAttribute(attribute).array].every(Number.isFinite)).toBe(true)
      }
      const normals = part.getAttribute('normal')
      const normal = new Vector3
      let unitNormals = true
      for (let i = 0; i < normals.count; i++) {
        if (Math.abs(normal.fromBufferAttribute(normals, i).length() - 1) > 1e-5) {
          unitNormals = false
        }
      }
      expect(unitNormals).toBe(true)
      expect(part.boundingBox!.min.y).toBeGreaterThanOrEqual(-1e-6)
      expect(part.boundingBox!.max.y).toBeLessThanOrEqual(pedestalHeight + 1e-6)
      triangles += triangleCount(part)
      expect(part.index).not.toBeNull()
      bytes += part.index!.array.byteLength + Object.values(part.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0)
    }
    expect(triangles).toBeLessThan(4600)
    expect(bytes).toBeLessThan(250_000)
  })
  test('matches visible flutes, collars, ledges and chamfers with physical collision on all four faces', () => {
    const meshes = [geometry.stone, geometry.bronze, geometry.reveals].map(part => new Mesh(part, material))
    const heights = [0.004, 0.053, 0.12, 0.2, 0.237, 0.247, 0.4, 0.83, 1.133, 1.16, 1.22, 1.3, 1.346].map(measured => measured * pedestalScale)
    // Just off a flute’s bottom and its end: a ray exactly along a trimesh edge can slip past Rapier.
    const offsets = [0.013, 0.048, 0.078, 0.141, 0.3291, 0.42, 0.466, 0.562].map(measured => measured * pedestalScale)
    for (let side = 0; side < 4; side++) {
      for (const y of heights) {
        for (const x of offsets) {
          const origin = new Vector3(x, y, 2)
          origin.applyAxisAngle(new Vector3(0, 1, 0), side * Math.PI / 2)
          const direction = new Vector3(0, 0, -1)
          direction.applyAxisAngle(new Vector3(0, 1, 0), side * Math.PI / 2)
          const sightline = new Raycaster(origin, direction, 0, 4)
          const visible = sightline.intersectObjects(meshes).at(0)
          const collision = world.castRay(new RAPIER.Ray(origin, direction), 4, true)
          expect(!!visible).toBe(!!collision)
          if (visible) {
            expect(collision!.timeOfImpact).toBeCloseTo(visible.distance, 5)
          }
        }
      }
    }
    const stone = meshes[0]
    const depth = (x: number) => {
      const fluteProbe = new Raycaster(new Vector3(x * pedestalScale, 0.7, 2), new Vector3(0, 0, -1))
      return fluteProbe.intersectObject(stone)[0].distance
    }
    expect(depth(0.047) - depth(0)).toBeCloseTo(0.022 * pedestalScale, 5)
  })
  test('keeps a dropped sculpture resting on the cap', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, pedestalHeight + 0.45, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.345, 0.0725, 0.455), body)
    for (let i = 0; i < 240; i++) {
      world.step()
    }
    expect(body.translation().y).toBeCloseTo(pedestalHeight + 0.0725, 2)
    expect(Math.abs(body.linvel().y)).toBeLessThan(0.01)
  })
  test('lets go of a flat prop held into the new cap short of it, not inside it', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, pedestalHeight + 0.08, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.345, 0.0725, 0.455).setEnabled(false), body)
    const placement = new PropPlacement(world, body)
    world.step()
    const position = placement.reach([0, pedestalHeight + 0.05, 1.8], [0, pedestalHeight - 0.15, 0.35])!
    expect(position).not.toBeNull()
    expect(placement.hasRoom(position)).toBe(true)
    expect(position[2]).toBeGreaterThan(capReach + 0.455)
  })
  for (const [x, z] of [[0, 1], [0, -1], [1, 0], [-1, 0], [-0.96, 0.28]] as const) {
    test(`picks up a settled three-part prop from direction ${x}, ${z}, including after canceling`, () => {
      // Separate parts, not a single bounding box: a lower part spawned inside the cap
      // can settle below it and trap the whole prop.
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, pedestalHeight + 0.08, 0).setCcdEnabled(true))
      for (const [width, height, depth, y] of [[0.64, 0.095, 0.86, 0], [0.69, 0.025, 0.91, -0.06], [0.69, 0.025, 0.91, 0.06]] as const) {
        world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(0, y, 0).setFriction(0.8).setRestitution(0.32), body)
      }
      const controller = new GrabbableBody(body, world)
      world.step()
      expect(controller.placement.hasRoom([body.translation().x, body.translation().y, body.translation().z])).toBe(true)
      for (let i = 0; i < 300; i++) {
        world.step()
      }
      expect(body.isSleeping()).toBe(true)
      expect(body.translation().y).toBeCloseTo(pedestalHeight + 0.0725, 2)
      const resting = body.translation()
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(controller.grab()).toBe(true)
        expect(body.isEnabled()).toBe(false)
        if (attempt === 0) {
          controller.cancel()
          expect(body.translation()).toEqual(resting)
        } else {
          // Held level toward the pedestal’s middle, it comes to rest against the cap’s edge.
          expect(controller.release([x * 1.8, pedestalHeight + 0.05, z * 1.8], [x * 0.35, pedestalHeight + 0.05, z * 0.35], true)).toBe(false)
          const released = body.translation()
          expect(Math.hypot(released.x - resting.x, released.z - resting.z)).toBeGreaterThan(capReach + 0.345)
          expect(controller.placement.hasRoom([released.x, released.y, released.z])).toBe(true)
          expect(body.isDynamic()).toBe(true)
          expect(body.linvel().y).toBe(2)
          for (let i = 0; i < body.numColliders(); i++) {
            expect(body.collider(i).isEnabled()).toBe(true)
          }
        }
      }
    })
  }
  test('owns and releases its geometry and uses a matte procedural stone material', () => {
    let disposed = 0
    for (const part of [geometry.stone, geometry.bronze, geometry.reveals]) {
      part.addEventListener('dispose', () => disposed++)
    }
    geometry.dispose()
    expect(disposed).toBe(3)
    const limestone = new LimestoneMaterial
    expect(limestone.colorNode).not.toBeNull()
    expect(limestone.roughnessNode).not.toBeNull()
    expect(limestone.metalness).toBe(0)
    limestone.dispose()
  })
})
