import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor, {defaultEgoOptions} from 'ego-player/motor'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {corridorPassage} from '../../src/lib/gallery/corridor.ts'
import lodge, {lodgeWindow, lodgeWindowFloor, lodgeWindowRibCutouts} from '../../src/lib/gallery/lodge.ts'
import LodgeWindowGeometry from '../../src/lib/gallery/LodgeWindowGeometry.ts'
import TimberGeometry, {timberProfile} from '../../src/lib/gallery/passages/TimberGeometry.ts'
import PlayerSession from '../../src/lib/gallery/PlayerSession.ts'
import {placementIssue, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {floorHeight, galleryPlacement, insideGallery, roomAt} from './fixtures/gallery.ts'
import samplePortraits from './fixtures/portraits.ts'

await RAPIER.init()
const material = new MeshBasicMaterial
const timber = TimberGeometry.passage(corridorPassage, lodgeWindowRibCutouts)
const recess = new LodgeWindowGeometry
const architecture = walls.filter(wall => wall.id === 'lodge-west' || wall.id.startsWith('corridor-wall_')).map(wall => ({
  wall,
  geometry: createArchitectureGeometry(wall),
}))
const opaque = [timber.shell, timber.ribs, recess.lining, recess.frame].map(geometry => new Mesh(geometry, material))
for (const {wall, geometry} of architecture) {
  for (const part of [geometry.surface, ...geometry.trim]) {
    const mesh = new Mesh(part, material)
    mesh.position.set(...wall.center)
    mesh.rotation.y = wall.rotation
    mesh.updateMatrixWorld(true)
    opaque.push(mesh)
  }
}
afterAll(() => {
  material.dispose()
  timber.dispose()
  recess.dispose()
  for (const {geometry} of architecture) {
    geometry.dispose()
  }
})
describe('Lodge through-window', () => {
  test('removes the post beneath the window without cutting the backing or neighboring frames', () => {
    const original = TimberGeometry.passage(corridorPassage)
    const before = [original.shell, original.ribs].map(geometry => new Mesh(geometry, material))
    const after = [timber.shell, timber.ribs].map(geometry => new Mesh(geometry, material))
    // Without bounds trees, the thousands of rays below test every triangle of the passage and take seconds.
    for (const mesh of [...before, ...after]) {
      mesh.geometry.boundsTree ??= new MeshBVH(mesh.geometry)
      mesh.raycast = acceleratedRaycast
    }
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    for (const geometry of [timber.shell, timber.ribs]) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry)))
    }
    world.step()
    try {
      let removedPosts = 0
      let previouslyRemoved = false
      for (let i = 0; i <= 160; i++) {
        const z = lodgeWindow.z - 2 + i * 0.025
        let removed = false
        for (const height of [0.1, 0.7, 1.2]) {
          for (const direction of [-1, 1]) {
            const origin = new Vector3(lodge.approachX, lodge.floorY + height, z)
            const aim = new Vector3(direction, 0, 0)
            const ray = new Raycaster(origin, aim, 0, lodge.timberWidth)
            const oldHit = ray.intersectObjects(before, false)[0]
            const newHit = ray.intersectObjects(after, false)[0]
            expect(newHit).toBeDefined()
            expect(world.castRay(new RAPIER.Ray(origin, aim), lodge.timberWidth, true)!.timeOfImpact).toBeCloseTo(newHit.distance, 5)
            if (direction > 0 && Math.abs(z - lodgeWindow.z) < lodgeWindow.width / 2) {
              expect(newHit.object).toBe(after[0])
              expect(newHit.point.x).toBeCloseTo(lodgeWindow.tunnelX, 5)
              removed ||= oldHit.distance < newHit.distance - 0.1
            } else {
              expect(newHit.distance).toBeCloseTo(oldHit.distance, 5)
            }
          }
        }
        if (removed && !previouslyRemoved) {
          removedPosts++
        }
        previouslyRemoved = removed
      }
      expect(removedPosts).toBe(1)
    } finally {
      original.dispose()
      world.free()
    }
  })
  test('a recess position restores crouched without waiting for physics broad-phase initialization', () => {
    const session = new PlayerSession(slopGallery)
    session.restore({
      position: [(lodgeWindow.roomX + lodgeWindow.tunnelX) / 2, lodgeWindow.bottom + 0.02, lodgeWindow.z],
      yaw: 0,
      pitch: 0,
    })
    const saved = session.snapshot()
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    for (const mesh of opaque) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(mesh.geometry)).setTranslation(mesh.position.x, mesh.position.y, mesh.position.z).setRotation(mesh.quaternion))
    }
    world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(recess.glass)))
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...saved.position))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
    const motor = new EgoMotor(RAPIER, world, body, collider)
    try {
      motor.teleport(saved.position, slopGallery.spawn.position)
      expect(motor.crouching).toBe(true)
      expect(body.translation().x).toBeCloseTo(saved.position[0], 5)
      expect(collider.halfHeight()).toBeCloseTo(defaultEgoOptions.crouchHeight / 2 - defaultEgoOptions.radius)
      for (let i = 0; i < 60; i++) {
        motor.step(1 / 60, {}, new Quaternion, false)
        world.step()
      }
      expect(motor.crouching).toBe(true)
      expect(motor.grounded).toBe(true)
      expect(body.translation().y).toBeCloseTo(saved.position[1], 2)
      expect(body.translation().y + defaultEgoOptions.crouchEyeHeight).toBeLessThan(lodgeWindow.top)
    } finally {
      motor.dispose()
      world.free()
    }
  })
  test('no reveal, glass or frame projects past the tunnel lining profile', () => {
    const profile = timberProfile(corridorPassage.width / 2 - 0.09, corridorPassage.height, 0).filter(point => point.x > 0).toSorted((a, b) => a.y - b.y)
    for (const geometry of [recess.lining, recess.glass, recess.frame]) {
      const positions = geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i) - lodge.floorY
        const upper = profile.findIndex(point => point.y >= y)
        const a = profile[upper - 1]
        const b = profile[upper]
        const boundary = lodge.approachX + a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)
        expect(positions.getX(i)).toBeGreaterThanOrEqual(boundary - 0.00001)
      }
    }
  })
  test('a crouching player can explore the recess, stop at the glass and back out', () => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    world.timestep = 1 / 60
    for (const mesh of opaque) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(mesh.geometry)).setTranslation(mesh.position.x, mesh.position.y, mesh.position.z).setRotation(mesh.quaternion))
    }
    world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(recess.glass)))
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(lodgeWindow.roomX - 0.35, lodgeWindow.bottom + 0.02, lodgeWindow.z))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
    const motor = new EgoMotor(RAPIER, world, body, collider)
    const facing = new Quaternion
    facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    try {
      for (let i = 0; i < 180; i++) {
        motor.step(world.timestep, {
          crouch: true,
          forward: true,
        }, facing)
        world.step()
      }
      expect(motor.crouching).toBe(true)
      expect(motor.grounded).toBe(true)
      expect(body.translation().y).toBeCloseTo(lodgeWindow.bottom + 0.02, 2)
      expect(body.translation().x).toBeCloseTo(lodgeWindow.tunnelX + lodgeWindow.glassThickness + 0.32, 2)
      const stoppedX = body.translation().x
      motor.step(world.timestep, {}, facing)
      world.step()
      expect(motor.crouching).toBe(true)
      for (let i = 0; i < 60; i++) {
        motor.step(world.timestep, {
          crouch: true,
          backward: true,
        }, facing)
        world.step()
      }
      expect(body.translation().x).toBeGreaterThan(stoppedX + 0.3)
      expect(motor.grounded).toBe(true)
    } finally {
      motor.dispose()
      world.free()
    }
  })
  test('cuts through both structural walls, plank lining and every intersecting rafter', () => {
    for (const height of [0.12, 0.5, 0.88]) {
      for (const across of [-0.42, 0, 0.42]) {
        const y = lodgeWindow.bottom + (lodgeWindow.top - lodgeWindow.bottom) * height
        const z = lodgeWindow.z + lodgeWindow.width * across
        const ray = new Raycaster(new Vector3(lodgeWindow.roomX + 0.5, y, z), new Vector3(-1, 0, 0), 0, lodgeWindow.roomX - lodgeWindow.tunnelX + 0.55)
        expect(ray.intersectObjects(opaque, false)).toHaveLength(0)
      }
    }
  })
  test('has one glass pane at the tunnel end, with matching collision in both directions', () => {
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    const glass = new Mesh(recess.glass, material)
    try {
      for (const mesh of opaque) {
        world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(mesh.geometry)).setTranslation(mesh.position.x, mesh.position.y, mesh.position.z).setRotation(mesh.quaternion))
      }
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(recess.glass)))
      world.step()
      for (const side of [-1, 1]) {
        const origin = new Vector3(side < 0 ? lodgeWindow.roomX + 0.5 : lodgeWindow.tunnelX - 0.5, (lodgeWindow.bottom + lodgeWindow.top) / 2, lodgeWindow.z)
        const direction = new Vector3(side, 0, 0)
        const glassRay = new Raycaster(origin, direction)
        const hit = glassRay.intersectObjects([...opaque, glass], false)[0]
        expect(hit.object).toBe(glass)
        expect(hit.point.x).toBeCloseTo(lodgeWindow.tunnelX + (side < 0 ? lodgeWindow.glassThickness : 0), 5)
        expect(world.castRay(new RAPIER.Ray(origin, direction), 10, true)!.timeOfImpact).toBeCloseTo(hit.distance, 5)
        expect(galleryPlacement.findPlacement(origin.toArray(), direction.toArray(), 1, 1, [])).toMatchObject({
          valid: false,
          reason: 'window',
        })
      }
    } finally {
      world.free()
    }
  })
  test('the four wood reveals close the cavity without duplicate faces at the room wall', () => {
    const x = (lodgeWindow.roomX + lodgeWindow.tunnelX) / 2
    const y = (lodgeWindow.bottom + lodgeWindow.top) / 2
    for (const direction of [new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)]) {
      const revealRay = new Raycaster(new Vector3(x, y, lodgeWindow.z), direction, 0, 2)
      const hits = revealRay.intersectObjects(opaque, false)
      expect(hits.length).toBeGreaterThan(0)
      expect(hits.filter(hit => Math.abs(hit.distance - hits[0].distance) < 0.0001)).toHaveLength(1)
    }
    expect(lodgeWindowFloor(x, lodgeWindow.z)).toBe(lodgeWindow.bottom)
    const point: [number, number, number] = [x, lodgeWindow.bottom + 0.2, lodgeWindow.z]
    expect(floorHeight(point)).toBe(lodgeWindow.bottom)
    expect(insideGallery(point)).toBe(true)
    expect(roomAt(point)).toBe('lodge')
  })
  test('rejects artwork overlapping the rectangular opening', () => {
    const wall = walls.find(value => value.id === 'lodge-west')!
    const portrait = {
      ...samplePortraits[0],
      wallId: wall.id,
      rotation: wall.rotation,
      width: 1,
      height: 0.8,
      position: wallPosition(wall, lodge.center[1] - lodgeWindow.z, (lodgeWindow.bottom + lodgeWindow.top) / 2),
    }
    expect(placementIssue(wall, portrait.position, portrait.width, portrait.height, [])).toBe('doorway')
    expect(portrait.hung).toBe(true)
  })
})
