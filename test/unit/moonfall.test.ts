import type {Vec3} from '../../src/lib/gallery/types.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {BoxGeometry, Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {moonfallApproachBays} from '../../src/lib/gallery/antechamber.ts'
import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {ceilingSlab} from '../../src/lib/gallery/moonfall/config.ts'
import staircase, {stairBlocks, stairFlights, stairFloorHeight, stairRailGeometry, stairRoofs, stairTurn} from '../../src/lib/gallery/staircase.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {placementIssue, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls, {floorHeight, galleryPlacement, insideGallery, roomAt, rooms} from './fixtures/gallery.ts'

await RAPIER.init()
const lower = rooms.find(candidate => candidate.id === 'moonfall')!
const upper = rooms.find(candidate => candidate.id === 'antechamber')!
describe('lower gallery', () => {
  test('stacked rooms, both stair flights and the U-turn landing resolve their own elevation', () => {
    expect(stairFlights[1].start[2]).toBe(staircase.returnZ)
    for (const block of stairBlocks) {
      const position: Vec3 = [block.position[0], block.top + 1.6, block.position[2]]
      expect(stairFloorHeight(position[0], position[2])).toBeCloseTo(block.top)
      expect(floorHeight(position)).toBeCloseTo(block.top)
      expect(insideGallery(position)).toBe(true)
      expect(roomAt(position)).toBe('moonfall')
    }
    // Moonfall reaches under the Antechamber.
    const [x, z] = [upper.center[0], upper.center[1] - 0.5]
    expect(roomAt([x, upper.floorY + 1.6, z])).toBe('antechamber')
    expect(roomAt([x, lower.floorY + 1.6, z])).toBe('moonfall')
    expect(floorHeight([x, upper.floorY + 1.6, z])).toBe(upper.floorY)
    expect(floorHeight([x, lower.floorY + 1.6, z])).toBe(lower.floorY)
    expect(floorHeight([x + 5, lower.floorY + 1.6, z])).toBe(lower.floorY)
    expect(insideGallery([x, lower.floorY - 0.95, z])).toBe(true)
    expect(insideGallery([x, lower.floorY - 1.01, z])).toBe(false)
    expect(insideGallery([8, -2, 16])).toBe(false)
    expect(insideGallery([Number.NaN, -2, 15])).toBe(false)
    // The landing turns the stairs halfway down.
    expect(stairFloorHeight(stairTurn.position[0], stairTurn.position[2])).toBe((upper.floorY + lower.floorY) / 2)
    expect(stairFloorHeight(8, 14.6)).toBeUndefined()
  })
  test('wall rays and frame clearance respect lower-level elevations and portals', () => {
    const wall = walls.find(candidate => candidate.id === 'moonfall-south')!
    const position = wallPosition(wall, 2, lower.floorY + 2.5)
    expect(position[1]).toBeCloseTo(-5.5)
    expect(placementIssue(wall, position, 2, 2, [])).toBe('')
    expect(placementIssue(wall, wallPosition(wall, 2, lower.floorY + 1), 2, 2, [])).toBe('frame')
    expect(galleryPlacement.findPlacement([-2, -5.5, 27], [0, 0, 1], 2, 2, [])).toMatchObject({
      wallId: wall.id,
      valid: true,
    })
    expect(galleryPlacement.findPlacement([4, -6.4, staircase.returnZ], [1, 0, 0], 1, 1, [])).toBeNull()
    expect(galleryPlacement.findPlacement([4, -6.4, 11.5], [1, 0, 0], 1, 1, [])?.wallId).toBe('moonfall-east')
    expect(galleryPlacement.findPlacement([10, 0.9, staircase.z], [0, 0, -1], 1, 1, [])).toMatchObject({
      valid: false,
      reason: 'unsticky',
    })
  })
  test('every tread matches the physical floor, and sidewalls close every tread edge', () => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    const material = new MeshBasicMaterial
    try {
      for (const block of stairBlocks) {
        world.createCollider(RAPIER.ColliderDesc.cuboid(block.size[0] / 2, block.size[1] / 2, block.size[2] / 2).setTranslation(...block.position))
      }
      world.step()
      for (const block of stairBlocks) {
        const geometry = new BoxGeometry(...block.size)
        try {
          const mesh = new Mesh(geometry, material)
          mesh.position.set(...block.position)
          mesh.updateMatrixWorld(true)
          const origin = new Vector3(block.position[0], 2, block.position[2])
          const direction = new Vector3(0, -1, 0)
          const treadRay = new Raycaster(origin, direction)
          expect(treadRay.intersectObject(mesh)[0].point.y).toBeCloseTo(block.top)
          expect(world.castRay(new RAPIER.Ray(origin, direction), 12, true)!.timeOfImpact).toBeCloseTo(2 - block.top)
        } finally {
          geometry.dispose()
        }
      }
      for (const flight of stairFlights) {
        for (const side of [-1, 1]) {
          const wall = flight.wall(side)
          const geometry = createArchitectureGeometry(wall)
          try {
            const mesh = new Mesh(geometry.surface, material)
            mesh.position.set(...wall.center)
            mesh.rotation.y = wall.rotation
            mesh.updateMatrixWorld(true)
            for (const block of flight.blocks) {
              for (const edge of [-0.499, 0, 0.499]) {
                const x = block.position[0] + block.size[0] * edge
                const ray = new Raycaster(new Vector3(x, block.top + 0.001, block.position[2]), new Vector3(0, 0, side), 0, flight.width / 2 + 0.5)
                expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
              }
            }
          } finally {
            geometry.dispose()
          }
        }
      }
    } finally {
      material.dispose()
      world.free()
    }
  })
  for (const fps of [30, 60, 120, 240]) {
    for (const offset of [-0.65, 0, 0.65]) {
      for (const sprint of [false, true]) {
        for (const ascending of [false, true]) {
          test(`${ascending ? 'ascends' : 'descends'} the U-turn stairs at ${fps} Hz, offset ${offset}, sprint ${sprint}`, () => {
            const world = new RAPIER.World({
              x: 0,
              y: -9.81,
              z: 0,
            })
            world.timestep = 1 / fps
            const geometries = walls.filter(wall => ['antechamber-approach_east', 'antechamber-approach_north', 'antechamber-approach_south', 'moonfall-east'].includes(wall.id) || wall.id.startsWith('moonfall-stairs_')).map(wall => ({
              wall,
              geometry: createArchitectureGeometry(wall),
            }))
            for (const {wall, geometry} of geometries) {
              const rotation = new Quaternion
              rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
              for (const [vertices, indices] of geometry.collision) {
                world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(...wall.center).setRotation(rotation))
              }
            }
            for (const block of stairBlocks) {
              world.createCollider(RAPIER.ColliderDesc.cuboid(block.size[0] / 2, block.size[1] / 2, block.size[2] / 2).setTranslation(...block.position))
            }
            for (const part of [stairTurn.floorGeometry(), stairTurn.roofGeometry(), stairRailGeometry('inner'), stairRailGeometry('outer')]) {
              const [vertices, indices] = colliderGeometry(part)
              world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin))
              part.dispose()
            }
            for (const beam of stairRoofs) {
              const beamRotation = new Quaternion
              beamRotation.setFromEuler(new Euler(...beam.rotation))
              world.createCollider(RAPIER.ColliderDesc.cuboid(beam.size[0] / 2, beam.size[1] / 2, beam.size[2] / 2).setTranslation(...beam.position).setRotation(beamRotation))
            }
            const approach = moonfallApproachBays.hall
            world.createCollider(RAPIER.ColliderDesc.cuboid(approach.size[0] / 2, 0.12, approach.size[1] / 2).setTranslation(approach.center[0], -0.12, approach.center[1]))
            world.createCollider(RAPIER.ColliderDesc.cuboid(lower.size[0] / 2, 0.15, lower.size[1] / 2).setTranslation(lower.center[0], lower.floorY - 0.15, lower.center[1]))
            world.createCollider(RAPIER.ColliderDesc.cuboid(lower.size[0] / 2, ceilingSlab.thickness / 2, lower.size[1] / 2).setTranslation(lower.center[0], lower.floorY + ceilingSlab.center, lower.center[1]))
            const path = [[staircase.startX - 1.2, staircase.z + offset], ...Array.from({length: 17}, (_, i) => stairTurn.point(i / 16 * Math.PI, stairTurn.radius - offset * (staircase.width + staircase.lowerWidth) / (2 * staircase.width))), [4.4, staircase.returnZ - offset * staircase.lowerWidth / staircase.width]]
            if (ascending) {
              path.reverse()
            }
            const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0][0], (ascending ? lower.floorY : 0) + 0.04, path[0][1]))
            const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
            const motor = new EgoMotor(RAPIER, world, body, collider)
            const facing = new Quaternion
            try {
              for (let i = 0; i < 30; i++) {
                motor.step(world.timestep, {}, facing)
                world.step()
              }
              let target = 1
              for (let i = 0; i < fps * 16 && target < path.length; i++) {
                const position = body.translation()
                const dx = path[target][0] - position.x
                const dz = path[target][1] - position.z
                // A sprint turns wider than the landing, so it heads for the next point early instead of circling this one.
                if (Math.hypot(dx, dz) < (sprint ? 0.6 : Math.max(0.14, 3 / fps))) {
                  target++
                  continue
                }
                facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
                motor.step(world.timestep, {
                  forward: true,
                  sprint,
                }, facing)
                world.step()
              }
              expect(target).toBe(path.length)
              for (let i = 0; i < 60; i++) {
                motor.step(world.timestep, {}, facing)
                world.step()
              }
              expect(body.translation().y).toBeCloseTo((ascending ? 0 : lower.floorY) + 0.02, 2)
              expect(motor.grounded).toBe(true)
            } finally {
              motor.dispose()
              world.free()
              for (const {geometry} of geometries) {
                geometry.dispose()
              }
            }
          })
        }
      }
    }
  }
})
