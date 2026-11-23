import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {BoxGeometry, DoubleSide, Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {antechamber, antechamberAnnexes, antechamberWings, moonfallApproach, upperGallery, upperGalleryStair} from '../../src/lib/gallery/antechamber.ts'
import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {floorThickness} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {balconyDeck, balconyDoor, balconyGuard, lobbyBalcony} from '../../src/lib/gallery/lobbyBalcony.ts'
import {ceilingMirrorY, ceilingSlab, ceilingTop} from '../../src/lib/gallery/moonfall/config.ts'
import {roomsAt} from '../../src/lib/gallery/roomVisibility.ts'
import staircase, {stairBlocks, stairRoofs, stairTurn} from '../../src/lib/gallery/staircase.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {openingTop, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import {enabledRooms} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

await RAPIER.init()
const walls = slopGallery.walls.filter(wall => wall.room === 'antechamber' || wall.id === 'lobby-south')
const material = new MeshBasicMaterial({side: DoubleSide})
const architecture = walls.map(wall => {
  const geometry = createArchitectureGeometry(wall)
  const mesh = new Mesh(geometry.surface, material)
  mesh.position.fromArray(wall.center)
  mesh.rotation.y = wall.rotation
  mesh.updateMatrixWorld()
  return {
    wall,
    geometry,
    mesh,
  }
})
afterAll(() => {
  material.dispose()
  for (const {geometry} of architecture) {
    geometry.dispose()
  }
})
const wallMeshes = architecture.map(part => part.mesh)
/** The solid decks and ceilings a steep ray can meet before (or instead of) a wall. */
const slabs = antechamberAnnexes.flatMap(({center: [x, z], size: [width, depth], ceiling, floorY}) => [
  {
    position: [x, floorY - floorThickness / 2, z] as Vec3,
    size: [width, floorThickness, depth] as Vec3,
  },
  {
    position: [x, ceiling + 0.09, z] as Vec3,
    size: [width, 0.18, depth] as Vec3,
  },
])
slabs.push({
  position: [antechamber.center[0], -floorThickness / 2, antechamber.center[1]],
  size: [antechamber.size[0], floorThickness, antechamber.size[1]],
})
const slabMeshes = [...slabs, balconyDeck].map(({position, size}) => {
  const mesh = new Mesh(new BoxGeometry(...size), material)
  mesh.position.fromArray(position)
  mesh.updateMatrixWorld()
  return mesh
})
afterAll(() => {
  for (const mesh of slabMeshes) {
    mesh.geometry.dispose()
  }
})
const blockers = [...wallMeshes, ...slabMeshes]
const southWall = walls.find(wall => wall.id === 'lobby-south')!
const moonfall = slopGallery.room('moonfall')
const up = new Vector3(0, 1, 0)
test('both Lobby doorways screen the relocated Moonfall approach and descent, even at flying height', () => {
  for (const mesh of blockers) {
    mesh.geometry.boundsTree = new MeshBVH(mesh.geometry)
    mesh.raycast = acceleratedRaycast
  }
  const ray = new Raycaster
  ray.firstHitOnly = true
  const targets = [
    ...[-1.17, 0, 1.17].flatMap(across => [0.15, 1.6, 2.8].map(y => new Vector3(moonfallApproach.x + across, y, antechamberWings.west.south + 0.2))),
    ...stairBlocks.flatMap(({position: [x, , z], size, top}) => [-0.48, 0, 0.48].flatMap(side => [0.04, 1.65, 3.05].map(height => new Vector3(x, top + height, z + side * size[2])))),
    ...Array.from({length: 13}, (_, i) => {
      const [x, z] = stairTurn.point(Math.PI * i / 12)
      return new Vector3(x, stairTurn.top + 1.6, z)
    }),
  ]
  const leaks: Array<string> = []
  let samples = 0
  for (const hole of southWall.holes!) {
    for (const across of [-0.98, -0.75, -0.5, 0, 0.5, 0.75, 0.98]) {
      const u = hole.u + hole.width / 2 * across
      const bottom = hole.bottom ?? 0
      const top = openingTop(hole, u)
      for (const height of [0.03, 0.14, 0.35, 0.5, 0.73, 0.94, 0.99]) {
        const aperture = new Vector3(...wallPosition(southWall, u, bottom + (top - bottom) * height, 0))
        for (const target of targets) {
          const travel = target.clone().sub(aperture)
          for (const z of [lobby.southZ - 0.17, lobby.southZ - 1, lobby.southZ - 3.3, -1, -10]) {
            const origin = aperture.clone().addScaledVector(travel, (z - aperture.z) / travel.z)
            if (Math.abs(origin.x) >= 7.89 || origin.y <= 0 || origin.y >= 13) {
              continue
            }
            samples++
            ray.set(origin, travel.clone().normalize())
            ray.far = origin.distanceTo(target) - 0.001
            if (!blockers.some(mesh => ray.intersectObject(mesh).length)) {
              leaks.push(`${hole.name}: ${origin.toArray().join(', ')} → ${target.toArray().join(', ')}`)
            }
          }
        }
      }
    }
  }
  expect(samples).toBeGreaterThan(10_000)
  expect(leaks.slice(0, 10)).toEqual([])
  expect(enabledRooms(slopGallery.fencesIn('lobby'))).not.toContain('moonfall')
  // A clear sightline does open once the visitor rounds the elbow.
  ray.set(new Vector3(staircase.startX - 2, 1.6, staircase.z), new Vector3(1, 0, 0))
  ray.far = 4
  expect(ray.intersectObjects(blockers)).toEqual([])
  expect(roomsAt([staircase.startX + 1, 1.6, staircase.z])).toContain('moonfall')
})
test('Moonfall uses the entire height beneath the ground slab, without cutting it for the stairs', () => {
  expect(moonfall.floorY + ceilingTop).toBeCloseTo(-floorThickness, 10)
  expect(moonfall.floorY + ceilingMirrorY).toBeCloseTo(-0.43, 10)
  expect(ceilingSlab.center + ceilingSlab.thickness / 2).toBeCloseTo(ceilingTop, 10)
  const east = moonfall.center[0] + moonfall.size[0] / 2
  for (const {position, size} of stairBlocks) {
    expect(position[0] - size[0] / 2).toBeGreaterThanOrEqual(east - 1e-9)
  }
  // A slanted beam can extend a little past a flight’s endpoints, but only the lower one meets the east wall.
  const [roof] = stairRoofs
  const halfReach = (roof.size[0] * Math.abs(Math.cos(roof.rotation[2])) + roof.size[1] * Math.abs(Math.sin(roof.rotation[2]))) / 2
  expect(roof.position[0] - halfReach).toBeGreaterThan(east)
  expect(stairTurn.center[0]).toBeGreaterThan(east)
  expect(slopGallery.roomAt([0, -0.5, 12])?.id).toBe('moonfall')
  expect(slopGallery.roomAt([0, 0.05, 12])?.id).toBe('antechamber')
})
const {hall, landing} = upperGallery
const stair = upperGalleryStair
const doorX = balconyDoor.x
const lowerEnd: Vec3 = [stair.end[0] - 1.4, stair.end[1], stair.end[2]]
const overlook: Vec3 = [doorX, lobbyBalcony.floorY, lobbyBalcony.frontZ + 0.7]
const path = [lowerEnd, [landing.center[0], landing.floorY, stair.start[2]], [landing.center[0], hall.floorY, hall.center[1]], [doorX, hall.floorY, hall.center[1]], overlook] satisfies ReadonlyArray<Vec3>
test('the east flight, balcony and long hall have separate walkable elevations', () => {
  expect(hall.size[0]).toBeGreaterThan(20)
  expect(balconyDoor.height - balconyDoor.bottom).toBeGreaterThan(2.5)
  expect(slopGallery.floorHeight([doorX, 0.8, hall.center[1]])).toBe(0)
  expect(slopGallery.floorHeight([doorX, 6, hall.center[1]])).toBe(hall.floorY)
  const treads = stair.blocks.map(({position: [x, , z], top}): Vec3 => [x, top, z])
  for (const [x, y, z] of [...path, ...treads]) {
    const eye: Vec3 = [x, y + 1.6, z]
    expect(slopGallery.contains(eye)).toBe(true)
    expect(slopGallery.floorHeight(eye)).toBeCloseTo(y, 10)
    expect(slopGallery.roomAt(eye)?.id).toBe(z >= lobby.southZ ? 'antechamber' : 'lobby')
  }
})
for (const fps of [30, 60, 120]) {
  for (const ascending of [true, false]) {
    test(`the player ${ascending ? 'climbs to' : 'returns from'} the Lobby balcony at ${fps} Hz`, () => {
      const world = new RAPIER.World({
        x: 0,
        y: -9.81,
        z: 0,
      })
      world.timestep = 1 / fps
      const track = ascending ? path : path.toReversed()
      const from = track[0]
      const end = track.at(-1)!
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(from[0], from[1] + 0.04, from[2]))
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
      const motor = new EgoMotor(RAPIER, world, body, collider)
      const facing = new Quaternion
      const box = ({position: [x, y, z], size: [width, height, depth]}: {
        position: ReadonlyArray<number>
        size: ReadonlyArray<number>
      }) => RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(x, y, z)
      try {
        for (const {geometry, wall} of architecture) {
          const rotation = new Quaternion
          rotation.setFromAxisAngle(up, wall.rotation)
          for (const [vertices, indices] of geometry.collision) {
            world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(...wall.center).setRotation(rotation))
          }
        }
        for (const block of [...slabs, balconyDeck, balconyGuard, ...stair.blocks]) {
          world.createCollider(box(block))
        }
        const roof = stair.beam(stair.headroom, 0.18, stair.width)
        const roofRotation = new Quaternion
        roofRotation.setFromEuler(new Euler(...roof.rotation))
        world.createCollider(box(roof).setRotation(roofRotation))
        let target = 1
        for (let i = 0; i < fps * 25 && target < track.length; i++) {
          const {x, z} = body.translation()
          const dx = track[target][0] - x
          const dz = track[target][2] - z
          if (Math.hypot(dx, dz) < 0.23) {
            target++
          } else {
            facing.setFromAxisAngle(up, Math.atan2(-dx, -dz))
            motor.step(world.timestep, {forward: true}, facing)
          }
          world.step()
        }
        expect(target).toBe(track.length)
        for (let i = 0; i < fps / 2; i++) {
          motor.step(world.timestep, {}, facing)
          world.step()
        }
        expect(body.translation().y).toBeCloseTo(end[1] + 0.02, 2)
        expect(motor.grounded).toBe(true)
        if (ascending) {
          for (let i = 0; i < fps; i++) {
            motor.step(world.timestep, {
              forward: true,
              sprint: true,
            }, new Quaternion)
            world.step()
          }
          expect(body.translation().z).toBeGreaterThan(lobbyBalcony.frontZ + 0.25)
          expect(motor.grounded).toBe(true)
        }
      } finally {
        motor.dispose()
        world.free()
      }
    })
  }
}
