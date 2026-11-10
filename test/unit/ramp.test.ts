import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {computeMeshVolume} from 'three-bvh-csg'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import lowerGallery, {oculusPlatform, oculusRamps, rampFloorHeight} from '../../src/lib/gallery/lowerGallery.ts'
import RampGeometry from '../../src/lib/gallery/RampGeometry.ts'
import walls, {floorHeight} from './fixtures/gallery.ts'
import {addOculusRailings} from './helpers/oculusRailings.ts'

await RAPIER.init()
test('matching access ramps flank the room with a clear central floor', () => {
  expect(oculusRamps).toHaveLength(2)
  const [west, east] = oculusRamps
  expect(west.x).toBe(-east.x)
  expect(west.x - west.width / 2).toBe(-lowerGallery.oculus.size[0] / 2)
  expect(east.x + east.width / 2).toBe(lowerGallery.oculus.size[0] / 2)
  expect({
    ...west,
    side: east.side,
    x: east.x,
  }).toEqual(east)
  expect(rampFloorHeight(0, -20)).toBeUndefined()
})
for (const ramp of oculusRamps) {
  describe(`${ramp.side}-wall access ramp`, () => {
    test('a closed cuboid-sided wedge meets the ground and raised platform exactly', () => {
      const geometry = new RampGeometry(ramp.width, ramp.rise, ramp.run)
      const material = new MeshBasicMaterial
      try {
        expect(computeMeshVolume(geometry)).toBeCloseTo(ramp.width * ramp.rise * ramp.run / 2, 4)
        expect(geometry.getAttribute('position').count).toBe(24)
        expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
        const mesh = new Mesh(geometry, material)
        mesh.position.set(ramp.x, ramp.floorY, ramp.startZ)
        mesh.updateMatrixWorld(true)
        expect(ramp.startZ - ramp.run).toBe(oculusPlatform.position[2] + oculusPlatform.size[2] / 2)
        expect(ramp.floorY + ramp.rise).toBe(oculusPlatform.position[1] + oculusPlatform.size[1] / 2)
        for (const distance of [0.01, 1, 4.5, 8, 8.99]) {
          const z = ramp.startZ - distance
          const top = ramp.floorY + distance / ramp.run * ramp.rise
          expect(rampFloorHeight(ramp.x, z)).toBeCloseTo(top)
          expect(floorHeight([ramp.x, top + 1.6, z])).toBeCloseTo(top)
          const ray = new Raycaster(new Vector3(ramp.x, 0, z), new Vector3(0, -1, 0))
          expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(top)
        }
        expect(rampFloorHeight(ramp.x + (ramp.side === 'west' ? -1 : 1) * ramp.width, ramp.startZ)).toBeUndefined()
        expect(rampFloorHeight(ramp.x, ramp.startZ + 0.01)).toBe(ramp.floorY)
        expect(rampFloorHeight(ramp.x, ramp.startZ - ramp.run - 0.01)).toBeUndefined()
      } finally {
        geometry.dispose()
        material.dispose()
      }
    })
    for (const fps of [30, 60, 120, 240]) {
      for (const offset of [-0.4, 0, 0.4]) {
        for (const sprint of [false, true]) {
          for (const ascending of [false, true]) {
            test(`${ascending ? 'ascends' : 'descends'} with handrails at ${fps} Hz, offset ${offset}, sprint ${sprint}`, () => {
              const geometry = new RampGeometry(ramp.width, ramp.rise, ramp.run)
              const wall = walls.find(value => value.id === `oculus-${ramp.side}`)!
              const wallGeometry = createArchitectureGeometry(wall)
              const world = new RAPIER.World({
                x: 0,
                y: -9.81,
                z: 0,
              })
              world.timestep = 1 / fps
              const [vertices, indices] = colliderGeometry(geometry)
              world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices).setTranslation(ramp.x, ramp.floorY, ramp.startZ))
              for (const [wallVertices, wallIndices] of wallGeometry.collision) {
                const wallRotation = new Quaternion
                wallRotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
                world.createCollider(RAPIER.ColliderDesc.trimesh(wallVertices, wallIndices).setTranslation(...wall.center).setRotation(wallRotation))
              }
              world.createCollider(RAPIER.ColliderDesc.cuboid(oculusPlatform.size[0] / 2, oculusPlatform.size[1] / 2, oculusPlatform.size[2] / 2).setTranslation(...oculusPlatform.position))
              world.createCollider(RAPIER.ColliderDesc.cuboid(lowerGallery.oculus.size[0] / 2, 0.12, lowerGallery.oculus.size[1] / 2).setTranslation(0, ramp.floorY - 0.12, lowerGallery.oculus.center[1]))
              addOculusRailings(world)
              const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(ramp.x + offset, ramp.floorY + (ascending ? 0 : ramp.rise) + 0.04, ascending ? ramp.startZ + 0.8 : ramp.startZ - ramp.run - 1))
              const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
              const motor = new EgoMotor(RAPIER, world, body, collider)
              const facing = new Quaternion
              facing.setFromAxisAngle(new Vector3(0, 1, 0), ascending ? 0 : Math.PI)
              try {
                let reached = false
                for (let i = 0; i < fps * 8; i++) {
                  motor.step(world.timestep, {
                    forward: true,
                    sprint,
                  }, facing)
                  world.step()
                  reached = ascending ? body.translation().z < ramp.startZ - ramp.run - 0.8 : body.translation().z > ramp.startZ + 0.8
                  if (reached) {
                    break
                  }
                }
                expect(reached).toBe(true)
                for (let i = 0; i < 60; i++) {
                  motor.step(world.timestep, {}, facing)
                  world.step()
                }
                expect(body.translation().y).toBeCloseTo(ramp.floorY + (ascending ? ramp.rise : 0) + 0.02, 2)
                expect(motor.grounded).toBe(true)
              } finally {
                motor.dispose()
                world.free()
                geometry.dispose()
                wallGeometry.dispose()
              }
            })
          }
        }
      }
    }
  })
}
