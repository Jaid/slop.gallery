import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {architectureGeometry, createArchitectureGeometry, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {baseboardCapHeight, defaultBaseboardHeight} from '../../src/lib/gallery/architectureDimensions.ts'
import walls from './fixtures/gallery.ts'

await RAPIER.init()
const lowerBandHeight = defaultBaseboardHeight - baseboardCapHeight
describe('plain doorway trim', () => {
  test('both jambs of the Oculus’ tunnel meet the baseboard cap without protruding plinths or doubled surfaces', () => {
    const wall = walls.find(value => value.id === 'oculus-south')!
    expect(wall.trimStyle).toBe('plain')
    const geometry = createArchitectureGeometry(wall)
    const material = new MeshBasicMaterial
    const meshes = [geometry.surface, ...geometry.trim].map(part => new Mesh(part, material))
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    try {
      for (const collision of geometry.collision) {
        world.createCollider(RAPIER.ColliderDesc.trimesh(...collision))
      }
      world.step()
      expect(geometry.trim[0].boundingBox!.max.z).toBeCloseTo(0.25, 6)
      // The staff doors open at the balcony’s level, high over the baseboard.
      const [tunnel, ...doors] = wall.holes!
      expect(tunnel.name).toBe('exhibition')
      expect(doors.every(door => door.bottom! > 6)).toBe(true)
      for (const hole of [tunnel]) {
        for (const side of [-1, 1]) {
          for (const offset of [0.04, wallOpeningTrim - 0.001, wallOpeningTrim + 0.001, 0.21, 0.3]) {
            for (const y of [0.02, 0.2, 0.209, 0.211, 0.239, 0.241, 0.249, 0.251, 1.2, 3]) {
              const origin = new Vector3(hole.u + side * (hole.width / 2 + offset), y, 1)
              const direction = new Vector3(0, 0, -1)
              let front = wallFace
              if (offset < wallOpeningTrim || y >= lowerBandHeight && y < defaultBaseboardHeight) {
                front = 0.25
              } else if (y < lowerBandHeight) {
                front = 0.2
              }
              const jambRay = new Raycaster(origin, direction, 0, 2)
              const hits = jambRay.intersectObjects(meshes)
              const hit = world.castRay(new RAPIER.Ray(origin, direction), 2, true)
              expect(hits[0].point.z).toBeCloseTo(front, 6)
              expect(hit!.timeOfImpact).toBeCloseTo(1 - front, 6)
              expect(hits.filter(value => Math.abs(value.point.z - front) < 0.00001)).toHaveLength(1)
            }
          }
        }
      }
    } finally {
      world.free()
      material.dispose()
      geometry.dispose()
    }
  })
  test('plain trim has its own cache entry and does not replace classic molding elsewhere', () => {
    const wall = walls.find(value => value.id === 'oculus-south')!
    const plain = architectureGeometry(wall)
    const classic = architectureGeometry({
      ...wall,
      trimStyle: 'classic',
    })
    expect(plain).not.toBe(classic)
    expect(architectureGeometry({...wall})).toBe(plain)
    expect(architectureGeometry({
      ...wall,
      trimStyle: undefined,
    })).toBe(classic)
    expect(classic.trim[0].boundingBox!.max.z).toBeCloseTo(0.325, 6)
    expect(walls.filter(value => value.trimStyle === 'plain').every(value => ['bastion', 'exhibition', 'lodge', 'oculus'].includes(value.room))).toBe(true)
  })
})
