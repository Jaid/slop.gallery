import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {moonfallCrater} from '../../src/lib/gallery/moonfall/config.ts'
import CraterGeometry from '../../src/lib/gallery/moonfall/CraterGeometry.ts'
import CraterTerrain, {craterTerrain} from '../../src/lib/gallery/moonfall/CraterTerrain.ts'
import {fenceFacing, fenceGuard, fencePosts, fenceSag, fenceShape} from '../../src/lib/gallery/moonfall/fence.ts'
import PlayerSession from '../../src/lib/gallery/PlayerSession.ts'
import RopeRing from '../../src/lib/gallery/railings/RopeRing.ts'
import {ropeTop, stanchionHeight} from '../../src/lib/gallery/railings/stanchion.ts'
import StanchionRingGeometry from '../../src/lib/gallery/railings/StanchionRingGeometry.ts'
import staircase from '../../src/lib/gallery/staircase.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {floorHeight, insideGallery, roomAt, rooms, roomVisit} from './fixtures/gallery.ts'

await RAPIER.init()
const room = rooms.find(value => value.id === 'moonfall')!
const geometry = new CraterGeometry
// the fewest and the most posts the seed can draw
const fences = moonfallCrater.fencePosts.map(count => new StanchionRingGeometry(moonfallCrater.fenceRadius, count, fenceShape(count)))
const [fence] = fences
const planarKey = (x: number, z: number) => `${x.toFixed(4)},${z.toFixed(4)}`
afterAll(() => {
  geometry.dispose()
  for (const ring of fences) {
    ring.dispose()
  }
})
function worldAt(fps = 60, ring = fence) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / fps
  for (const part of [geometry.floor, geometry.terrain, geometry.rocks, ...ring.collision]) {
    const args = colliderGeometry(part)
    world.createCollider(RAPIER.ColliderDesc.trimesh(...args, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin))
  }
  return world
}
describe('Moonfall impact hall', () => {
  test('the square hall connects both of its doorways', () => {
    expect(room.size).toEqual([28, 28])
    const north = walls.find(wall => wall.id === 'moonfall-north')!
    const east = walls.find(wall => wall.id === 'moonfall-east')!
    expect(wallPosition(north, north.holes![0].u, room.floorY, 0)).toEqual([lowerGallery.tunnel.x, room.floorY, lowerGallery.tunnel.southZ])
    const portal = wallPosition(east, east.holes![0].u, room.floorY, 0)
    expect(portal[0]).toBe(staircase.endX)
    expect(portal[2]).toBeCloseTo(staircase.returnZ)
    const visit = roomVisit(room).position
    expect(Math.hypot(visit[0] - room.center[0], visit[2] - room.center[1])).toBeGreaterThan(moonfallCrater.fenceRadius + 0.6)
    for (const [x, z] of [[-20, 6], [-20, 30], [4, 30]]) {
      expect(insideGallery([x, -6.4, z])).toBe(true)
      expect(roomAt([x, -6.4, z])).toBe('moonfall')
    }
  })
  test('the floor has a real circular void and the crater is deep, deterministic and textured', () => {
    const material = new MeshBasicMaterial
    const floor = new Mesh(geometry.floor, material)
    const terrain = new Mesh(geometry.terrain, material)
    const second = new CraterTerrain
    try {
      for (const part of [geometry.floor, geometry.terrain, geometry.rocks, ...fences.flatMap(ring => [ring.posts, ...ring.collision])]) {
        for (const attribute of Object.values(part.attributes)) {
          expect([...attribute.array].every(Number.isFinite)).toBe(true)
        }
      }
      expect(triangleCount(geometry.terrain)).toBeLessThan(12_000)
      expect(triangleCount(geometry.terrain) + triangleCount(geometry.rocks)).toBeLessThan(16_000)
      for (const [x, z] of [[0, 0], [2, 1], [-4, -3], [7.1, 0], [0, 8.99]]) {
        const ray = new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0))
        expect(ray.intersectObject(floor)).toHaveLength(0)
        const hit = ray.intersectObject(terrain)[0]
        expect(hit).toBeDefined()
        expect(hit.point.y).toBeCloseTo(craterTerrain.height(x, z), 1)
        expect(second.height(x, z)).toBe(craterTerrain.height(x, z))
      }
      expect(craterTerrain.height(0, 0)).toBeLessThan(-2.8)
      expect(craterTerrain.height(2.5, 0)).toBeLessThan(-3)
      for (let i = 0; i < 32; i++) {
        const angle = i * Math.PI / 16
        expect(craterTerrain.height(Math.cos(angle) * 9, Math.sin(angle) * 9)).toBeCloseTo(0, 8)
      }
      const outside = new Raycaster(new Vector3(10.5, 2, 0), new Vector3(0, -1, 0))
      expect(outside.intersectObject(floor)[0].point.y).toBeCloseTo(0)
      expect(outside.intersectObject(terrain)).toHaveLength(0)
    } finally {
      material.dispose()
    }
  })
  test('the low-poly terrain follows its height field and closes seamlessly against the floor', () => {
    const material = new MeshBasicMaterial
    const terrain = new Mesh(geometry.terrain, material)
    const ray = new Raycaster
    const down = new Vector3(0, -1, 0)
    try {
      let squared = 0
      let count = 0
      for (let ring = 0; ring < 30; ring++) {
        for (let i = 0; i < 48; i++) {
          const r = (ring + 0.5) / 30 * (moonfallCrater.radius - 0.05)
          const angle = (i + ring * 0.37) / 48 * Math.PI * 2
          const x = Math.cos(angle) * r
          const z = Math.sin(angle) * r
          ray.set(new Vector3(x, 3, z), down)
          const error = ray.intersectObject(terrain)[0].point.y - craterTerrain.height(x, z)
          expect(Math.abs(error)).toBeLessThan(0.16)
          squared += error ** 2
          count++
        }
      }
      expect(Math.sqrt(squared / count)).toBeLessThan(0.04)
    } finally {
      material.dispose()
    }
    const rim = new Set<string>
    const terrainPositions = geometry.terrain.getAttribute('position')
    for (let i = 0; i < terrainPositions.count; i++) {
      if (!(Math.abs(Math.hypot(terrainPositions.getX(i), terrainPositions.getZ(i)) - moonfallCrater.radius) < 1e-5)) {
        continue
      }
      expect(terrainPositions.getY(i)).toBeCloseTo(0, 8)
      rim.add(planarKey(terrainPositions.getX(i), terrainPositions.getZ(i)))
    }
    expect(rim.size).toBe(moonfallCrater.rimSegments)
    const floorPositions = geometry.floor.getAttribute('position')
    const hole = new Set<string>
    for (let i = 0; i < floorPositions.count; i++) {
      if (Math.abs(floorPositions.getY(i)) < 1e-6 && Math.abs(Math.hypot(floorPositions.getX(i), floorPositions.getZ(i)) - moonfallCrater.radius) < 1e-4) {
        hole.add(planarKey(floorPositions.getX(i), floorPositions.getZ(i)))
      }
    }
    expect(hole).toEqual(rim)
    const index = geometry.terrain.index!
    const edges = new Map<string, number>
    for (let i = 0; i < index.count; i += 3) {
      const corners = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
      const [a, b, c] = corners.map(corner => {
        const cornerPosition = new Vector3
        return cornerPosition.fromBufferAttribute(terrainPositions, corner)
      })
      expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0)
      for (let k = 0; k < 3; k++) {
        const edge = [corners[k], corners[(k + 1) % 3]].toSorted((first, second) => first - second).join()
        edges.set(edge, (edges.get(edge) ?? 0) + 1)
      }
    }
    expect(edges.values().filter(uses => uses === 1).toArray()).toHaveLength(moonfallCrater.rimSegments)
    expect(edges.values().every(uses => uses <= 2)).toBe(true)
  })
  test('the crater floor participates in prop recovery, room lookup and player poses', () => {
    for (const [x, z] of [[0, 0], [2.5, -1], [-4, 2]]) {
      const ground = room.floorY + craterTerrain.height(x, z)
      const position: Vec3 = [x + room.center[0], ground + 0.15, z + room.center[1]]
      expect(floorHeight(position)).toBeCloseTo(ground)
      expect(insideGallery(position)).toBe(true)
      expect(roomAt(position)).toBe('moonfall')
      const session = new PlayerSession(slopGallery)
      session.capture({
        position,
        yaw: 1.3,
        pitch: 0,
      })
      expect(session.snapshot()).toEqual({
        position,
        yaw: 1.3,
        pitch: 0,
      })
      expect(slopGallery.placement.contains(position)).toBe(true)
    }
  })
  test('dropped objects land inside the depression, not on an invisible flat floor', () => {
    const world = worldAt()
    const bodies = [[0, 0], [2.5, 0], [-2.2, -1.5]].map(([x, z]) => {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1, z).setCcdEnabled(true))
      world.createCollider(RAPIER.ColliderDesc.ball(0.13).setRestitution(0), body)
      return body
    })
    try {
      for (let i = 0; i < 360; i++) {
        world.step()
      }
      for (const body of bodies) {
        const {x, y, z} = body.translation()
        expect(y).toBeLessThan(-2)
        expect(y).toBeGreaterThan(-4)
        expect(y).toBeGreaterThan(craterTerrain.height(x, z))
      }
    } finally {
      world.free()
    }
  })
  test('the seed draws 16 to 32 posts, every count from the fewest to the most', () => {
    const counts = new Set(Array.from({length: 2000}, (_, seed) => fencePosts(seed)))
    expect(Math.min(...counts)).toBe(16)
    expect(Math.max(...counts)).toBe(32)
    expect(counts.size).toBe(17)
    expect(fencePosts(1234)).toBe(fencePosts(1234))
  })
  test('the middle of a rope, never a post, faces the stairs from the Antechamber', () => {
    const stairs = new Vector3(staircase.endX - room.center[0], 0, staircase.returnZ - room.center[1])
    stairs.normalize()
    expect(Math.cos(fenceFacing)).toBeCloseTo(stairs.x)
    expect(Math.sin(fenceFacing)).toBeCloseTo(stairs.z)
    for (const count of moonfallCrater.fencePosts) {
      const rope = new RopeRing(moonfallCrater.fenceRadius, count, fenceSag(count), fenceFacing)
      const facing = Array.from({length: count}, (_, i) => rope.getPoint((i + 0.5) / count)).find(point => Math.hypot(point.x - Math.cos(fenceFacing) * rope.radius, point.z - Math.sin(fenceFacing) * rope.radius) < 1e-9)
      expect(facing).toBeDefined()
      expect(facing!.y).toBeCloseTo(ropeTop - rope.sag)
    }
  })
  test('the more the posts, the deeper the ropes sag, down to three quarters of the meter-high posts with the fewest and a quarter of them with the most', () => {
    const [fewest, most] = moonfallCrater.fencePosts
    const sags = Array.from({length: most - fewest + 1}, (_, i) => fenceSag(fewest + i))
    expect(sags.every((sag, i) => i === 0 || sag > sags[i - 1])).toBe(true)
    expect(stanchionHeight).toBe(1)
    expect(ropeTop - sags[0]).toBeCloseTo(0.75)
    expect(ropeTop - sags.at(-1)!).toBeCloseTo(0.25)
  })
  test('a guard strip fills in over the ropes only where they hang under the guard', () => {
    const [shallow, deep] = fences
    expect(shallow.guardStrip).toBeUndefined()
    const positions = deep.guardStrip!.getAttribute('position')
    // Strip corners alternate between the rope’s axis and the strip’s top.
    const heights = Array.from({length: positions.count}, (_, i) => positions.getY(i))
    const tops = heights.filter((_, i) => i % 2 === 1)
    expect(Math.min(...heights)).toBeCloseTo(ropeTop - deep.sag, 2)
    expect(Math.min(...tops)).toBeCloseTo(fenceGuard)
    for (let i = 0; i < positions.count; i++) {
      expect(Math.hypot(positions.getX(i), positions.getZ(i))).toBeCloseTo(moonfallCrater.fenceRadius)
    }
  })
  for (const ring of fences) {
    test(`the rope of ${ring.count} posts closes exactly, sags between posts and stays outside the cut edge`, () => {
      const rope = new RopeRing(ring.radius, ring.count, ring.sag, ring.facing)
      expect(rope.getPoint(0).distanceTo(rope.getPoint(1))).toBeLessThan(1e-10)
      expect(rope.getPoint(0.5 / ring.count).y).toBeCloseTo(ropeTop - ring.sag)
      expect(rope.getPoint(1 / ring.count).y).toBeCloseTo(ropeTop)
      for (let i = 0; i <= 256; i++) {
        const {x, z} = rope.getPoint(i / 256)
        expect(Math.hypot(x, z)).toBeGreaterThan(moonfallCrater.radius + 0.8)
      }
      const world = worldAt(60, ring)
      try {
        world.step()
        // Under the middle of the rope facing the stairs, halfway down from where it hangs lowest.
        const origin = new Vector3(Math.cos(ring.facing) * 11, (ropeTop - ring.sag) / 2, Math.sin(ring.facing) * 11)
        const direction = new Vector3(-Math.cos(ring.facing), 0, -Math.sin(ring.facing))
        expect(world.castRay(new RAPIER.Ray(origin, direction), 1.5, true)).toBeNull()
      } finally {
        world.free()
      }
    })
  }
  for (const fps of [30, 60, 120]) {
    for (const ring of fences) {
      test(`the stanchion barrier of ${ring.count} posts stops sprinting at posts and between them at ${fps} Hz`, () => {
        const world = worldAt(fps, ring)
        try {
          // The middle of a rope, a post, halfway between them and a few anywhere.
          for (const angle of [ring.facing, ring.facing + Math.PI / ring.count, ring.facing + Math.PI / ring.count / 2, 0.7, 1.8, 3.4, 5.7]) {
            const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(Math.cos(angle) * 11.2, 0.04, Math.sin(angle) * 11.2))
            const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
            const motor = new EgoMotor(RAPIER, world, body, collider)
            const facing = new Quaternion
            facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(Math.cos(angle), Math.sin(angle)))
            for (let i = 0; i < fps * 2; i++) {
              motor.step(world.timestep, {
                forward: true,
                sprint: true,
              }, facing)
              world.step()
            }
            const p = body.translation()
            expect(Math.hypot(p.x, p.z)).toBeGreaterThan(moonfallCrater.fenceRadius + 0.2)
            expect(p.y).toBeCloseTo(0.02, 2)
            motor.dispose()
            world.removeRigidBody(body)
          }
        } finally {
          world.free()
        }
      })
    }
  }
  test('a full walking circuit around the protected crater stays open', () => {
    const world = worldAt()
    const architecture = walls.filter(w => w.room === 'moonfall' && !w.id.includes('stairs')).map(wall => ({
      wall,
      geometry: createArchitectureGeometry(wall),
    }))
    for (const {wall, geometry: part} of architecture) {
      for (const args of part.collision) {
        const wallRotation = new Quaternion
        world.createCollider(RAPIER.ColliderDesc.trimesh(...args).setTranslation(wall.center[0] - room.center[0], 0, wall.center[2] - room.center[1]).setRotation(wallRotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)))
      }
    }
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(11, 0.04, 0))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
    const motor = new EgoMotor(RAPIER, world, body, collider)
    const facing = new Quaternion
    try {
      let waypoint = 1
      for (let i = 0; i < 2400 && waypoint <= 32; i++) {
        const angle = waypoint * Math.PI / 16
        const current = body.translation()
        const dx = Math.cos(angle) * 11 - current.x
        const dz = Math.sin(angle) * 11 - current.z
        if (Math.hypot(dx, dz) < 0.18) {
          waypoint++
          continue
        }
        facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
        motor.step(world.timestep, {forward: true}, facing)
        world.step()
      }
      expect(waypoint).toBe(33)
      expect(motor.grounded).toBe(true)
    } finally {
      motor.dispose()
      world.free()
      for (const {geometry: part} of architecture) {
        part.dispose()
      }
    }
  })
})
