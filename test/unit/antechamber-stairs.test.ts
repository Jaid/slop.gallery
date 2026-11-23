import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {antechamberSize, antechamberZ, eastStair, stairHalls} from '../../src/lib/gallery/antechamber.ts'
import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {floorThickness} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {ceilingMirrorY, ceilingSlab} from '../../src/lib/gallery/moonfall/config.ts'
import staircase, {stairFlights} from '../../src/lib/gallery/staircase.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'

await RAPIER.init()
const material = new MeshBasicMaterial
const shell = walls.filter(wall => wall.room === 'antechamber').map(wall => {
  const geometry = createArchitectureGeometry(wall)
  const mesh = new Mesh(geometry.surface, material)
  mesh.position.set(...wall.center)
  mesh.rotation.y = wall.rotation
  mesh.updateMatrixWorld(true)
  return {
    mesh,
    geometry,
  }
})
afterAll(() => {
  material.dispose()
  for (const {geometry} of shell) {
    geometry.dispose()
  }
})
test('no sightline through the Lobby doorway reaches the mouth of Moonfall’s staircase', () => {
  // Any direct ray has to cross both openings. Start just *inside* the first, so even a camera pressed against a Lobby jamb or flown to its lintel is covered. Do not rely on culling, a painting or even trim to stop it.
  const surfaces = shell.map(({mesh}) => mesh)
  const ray = new Raycaster
  const direction = new Vector3
  const blocked = (origin: Vector3, target: Vector3) => {
    ray.set(origin, direction.subVectors(target, origin).normalize())
    ray.far = origin.distanceTo(target)
    return ray.intersectObjects(surfaces, false).length > 0
  }
  for (const u of [-0.499, -0.25, 0, 0.25, 0.499]) {
    for (const v of [0.01, 0.8, 1.62, 2.7, 3.59]) {
      const eye = new Vector3(u * lobby.antechamberDoorWidth, v, lobby.southZ + 0.12)
      for (const across of [-0.499, -0.25, 0, 0.25, 0.499]) {
        for (const y of [0.01, 0.8, 1.62, 2.7, 3.59]) {
          expect(blocked(eye, new Vector3(staircase.startX + 0.01, y, staircase.z + across * staircase.width))).toBe(true)
        }
      }
    }
  }
  // The door really is open from the return, all the way across the tread.
  for (const across of [-0.45, 0, 0.45]) {
    const z = staircase.z + across * staircase.width
    expect(blocked(new Vector3(staircase.startX - 1, 1.62, z), new Vector3(staircase.startX + 1, 1.62, z))).toBe(false)
  }
})
test('the full Moonfall slab fits under the upper floor without cutting either flight', () => {
  const {moonfall: {center, size}, floorY} = lowerGallery
  expect(floorY + ceilingSlab.center + ceilingSlab.thickness / 2).toBeCloseTo(-floorThickness, 8)
  expect(ceilingSlab.center - ceilingSlab.thickness / 2).toBeGreaterThan(7.5)
  expect(ceilingMirrorY).toBeCloseTo(ceilingSlab.center - ceilingSlab.thickness / 2 - 0.01)
  expect(Math.max(...stairFlights[0].outline().map(([, z]) => z))).toBeLessThan(center[1] - size[1] / 2)
  expect(Math.min(...stairFlights[1].outline().map(([x]) => x))).toBe(center[0] + size[0] / 2)
})
test('one can walk between the west return and the blind upper landing in both directions', () => {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  const box = (p: Vec3, s: Vec3, rotation?: Vec3) => {
    const collider = RAPIER.ColliderDesc.cuboid(s[0] / 2, s[1] / 2, s[2] / 2).setTranslation(...p)
    if (rotation) {
      const q = new Quaternion
      collider.setRotation(q.setFromEuler(new Euler(...rotation)))
    }
    world.createCollider(collider)
  }
  for (const {geometry, mesh} of shell) {
    for (const [v, i] of geometry.collision) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(v, i, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(mesh.position.x, mesh.position.y, mesh.position.z).setRotation(mesh.quaternion))
    }
  }
  for (const {center, size} of [{
    center: [0, antechamberZ],
    size: antechamberSize,
  }, ...Object.values(stairHalls)]) {
    box([center[0], -0.12, center[1]], [size[0], 0.24, size[1]])
  }
  for (const {position, size, top} of eastStair.blocks) {
    box(position, size)
    const eye: Vec3 = [position[0], top + 1.6, position[2]]
    expect(roomAt(eye)).toBe('antechamber')
    expect(insideGallery(eye)).toBe(true)
    expect(floorHeight(eye)).toBeCloseTo(top, 8)
  }
  const roof = eastStair.beam(eastStair.headroom, 0.18, eastStair.width)
  box(roof.position, roof.size, roof.rotation)
  const [x, y, z] = eastStair.start
  const stops = [[staircase.startX - 0.65, staircase.z], [stairHalls.west.center[0], staircase.z], stairHalls.west.center, [x - 0.6, z]]
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(stops[0][0], 0.04, stops[0][1]))
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
  const motor = new EgoMotor(RAPIER, world, body, collider)
  const facing = new Quaternion
  try {
    for (const path of [stops.slice(1), stops.toReversed().slice(1)]) {
      for (const [toX, toZ] of path) {
        for (let frame = 0; frame < 1000; frame++) {
          const p = body.translation()
          if (Math.hypot(p.x - toX, p.z - toZ) < 0.1) {
            break
          }
          facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(p.x - toX, p.z - toZ))
          motor.step(world.timestep, {forward: true}, facing)
          world.step()
        }
        const p = body.translation()
        expect(Math.hypot(p.x - toX, p.z - toZ)).toBeLessThan(0.1)
        expect(p.y).toBeCloseTo((toX > eastStair.end[0] ? y : 0) + 0.02, 2)
      }
    }
  } finally {
    motor.dispose()
    world.free()
  }
})
