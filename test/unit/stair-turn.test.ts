import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import CurvedBoxGeometry from '../../src/lib/gallery/CurvedBoxGeometry.ts'
import staircase, {stairFlights, stairFloorHeight, stairRoofs, stairTurn} from '../../src/lib/gallery/staircase.ts'
import StairTurn from '../../src/lib/gallery/stairs/StairTurn.ts'
import {wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls, {galleryPlacement, insideGallery, roomAt} from './fixtures/gallery.ts'

await RAPIER.init()
describe('round stair landing', () => {
  test('joins both flights tangentially at their full width without square corners', () => {
    for (const radius of [stairTurn.innerRadius, stairTurn.radius, stairTurn.outerRadius]) {
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4, Math.PI]) {
        const [x, z] = stairTurn.point(angle, radius)
        expect(stairFloorHeight(x, z)).toBe(stairTurn.top)
        expect(insideGallery([x, stairTurn.top + 1.6, z])).toBe(true)
        expect(roomAt([x, stairTurn.top + 1.6, z])).toBe('moonfall')
      }
    }
    expect(stairTurn.point(0)[1]).toBeCloseTo(staircase.z)
    expect(stairTurn.point(Math.PI)[1]).toBeCloseTo(staircase.returnZ)
    expect(stairTurn.point(0, stairTurn.innerRadius)[1] - stairTurn.point(0, stairTurn.outerRadius)[1]).toBeCloseTo(staircase.width)
    expect(stairTurn.point(Math.PI, stairTurn.outerRadius)[1] - stairTurn.point(Math.PI, stairTurn.innerRadius)[1]).toBeCloseTo(staircase.lowerWidth)
    expect(stairFloorHeight(staircase.turnX + staircase.width, staircase.z - staircase.width / 2)).toBeUndefined()
    expect(stairFloorHeight(staircase.turnX + stairTurn.innerRadius / 2, stairTurn.innerCenterZ)).toBeUndefined()
    expect(stairTurn.contains(Number.NaN, 0)).toBe(false)
  })
  test('visual and physical landing surfaces agree throughout the semicircle', () => {
    const geometry = stairTurn.floorGeometry()
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    try {
      const [vertices, indices] = colliderGeometry(geometry)
      world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
      world.step()
      for (let i = 1; i < 32; i++) {
        for (const radius of [stairTurn.innerRadius + 0.05, stairTurn.radius, stairTurn.outerRadius - 0.05]) {
          const [x, z] = stairTurn.point(i / 32 * Math.PI, radius)
          const origin = new Vector3(x, stairTurn.top + 2, z)
          const direction = new Vector3(0, -1, 0)
          const landingRay = new Raycaster(origin, direction)
          expect(landingRay.intersectObject(mesh)[0].point.y).toBeCloseTo(stairTurn.top, 5)
          expect(world.castRay(new RAPIER.Ray(origin, direction), 3, true)!.timeOfImpact).toBeCloseTo(2, 5)
        }
      }
      const empty = new Vector3(staircase.turnX + 0.1, stairTurn.top + 2, stairTurn.innerCenterZ)
      const gapRay = new Raycaster(empty, new Vector3(0, -1, 0))
      expect(gapRay.intersectObject(mesh)).toHaveLength(0)
      expect(world.castRay(new RAPIER.Ray(empty, new Vector3(0, -1, 0)), 3, true)).toBeNull()
    } finally {
      world.free()
      geometry.dispose()
      material.dispose()
    }
  })
  test('walls, moldings and placement rays follow both arcs', () => {
    const material = new MeshBasicMaterial
    try {
      for (const wall of stairTurn.walls()) {
        const geometry = createArchitectureGeometry(wall)
        const mesh = new Mesh(geometry.surface, material)
        mesh.position.set(...wall.center)
        mesh.rotation.y = wall.rotation
        mesh.updateMatrixWorld(true)
        try {
          expect(geometry.cornice).toHaveLength(2)
          for (const fraction of [-0.49, -0.25, 0, 0.25, 0.49]) {
            const u = wall.width * fraction
            const y = stairTurn.top + 1.6
            const origin = new Vector3(...wallPosition(wall, u, y, 0.8))
            const surface = new Vector3(...wallPosition(wall, u, y, wallFace))
            const direction = surface.clone().sub(origin).normalize()
            expect(wallCoordinates(wall, wallPosition(wall, u, y))).toBeCloseTo(u, 5)
            const wallRay = new Raycaster(origin, direction)
            const hit = wallRay.intersectObject(mesh)[0]
            expect(hit.distance).toBeCloseTo(0.8 - wallFace, 2)
            const placement = galleryPlacement.findPlacement(origin.toArray(), direction.toArray(), 1, 1, [])
            expect(placement?.wallId).toBe(wall.id)
            expect(placement?.valid).toBe(false)
            expect(placement?.reason).toBe('unsticky')
          }
          for (const part of [geometry.surface, ...geometry.trim, ...geometry.cornice]) {
            const positions = part.getAttribute('position')
            const normals = part.getAttribute('normal')
            for (let i = 0; i < positions.count; i++) {
              expect([positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite)).toBe(true)
              expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 5)
            }
          }
        } finally {
          geometry.dispose()
        }
      }
    } finally {
      material.dispose()
    }
  })
  test('the landing riser has no coplanar wall or molding caps at either flight', () => {
    const material = new MeshBasicMaterial
    const floor = stairTurn.floorGeometry()
    const architecture = stairTurn.walls().map(wall => ({
      wall,
      geometry: createArchitectureGeometry(wall),
    }))
    const meshes: Array<Mesh> = [new Mesh(floor, material)]
    try {
      for (const {wall, geometry} of architecture) {
        expect(geometry.surface.boundingBox!.min.y + wall.center[1]).toBeCloseTo(stairTurn.top, 5)
        expect(geometry.trim[0].boundingBox!.max.y + wall.center[1]).toBeCloseTo(stairTurn.top + 0.14, 5)
        expect(geometry.cornice[1].boundingBox!.max.y + wall.center[1]).toBeCloseTo(stairTurn.top + 3.195, 5)
        for (const part of [geometry.surface, ...geometry.trim]) {
          const mesh = new Mesh(part, material)
          mesh.position.set(...wall.center)
          mesh.rotation.y = wall.rotation
          mesh.updateMatrixWorld(true)
          meshes.push(mesh)
        }
      }
      for (const z of [
        stairTurn.innerCenterZ - stairTurn.innerRadius - 0.16,
        stairTurn.innerCenterZ + stairTurn.innerRadius + 0.16,
        stairTurn.outerCenterZ - stairTurn.outerRadius + 0.16,
        stairTurn.outerCenterZ + stairTurn.outerRadius - 0.16,
      ]) {
        for (const depth of [0.025, 0.1, 0.25]) {
          const ray = new Raycaster(new Vector3(staircase.turnX - 1, stairTurn.top - depth, z), new Vector3(1, 0, 0), 0, 1.01)
          const hits = ray.intersectObjects(meshes, false)
          expect(hits).toHaveLength(1)
          expect(hits[0].object).toBe(meshes[0])
          expect(hits[0].distance).toBeCloseTo(1, 5)
        }
      }
    } finally {
      floor.dispose()
      material.dispose()
      for (const {geometry} of architecture) {
        geometry.dispose()
      }
    }
  })
  test('the lower flight, ceiling, rails and room doorway all use the wider span', () => {
    expect(staircase.lowerWidth).toBeGreaterThan(staircase.width)
    const doorway = walls.find(wall => wall.id === 'moonfall-east')!.holes!.find(hole => hole.width === staircase.lowerWidth)!
    expect(doorway.width).toBe(staircase.lowerWidth)
    const [upper, lower] = stairFlights
    expect(upper.width).toBe(staircase.width)
    expect(lower.width).toBe(staircase.lowerWidth)
    expect(lower.start[2]).toBe(staircase.returnZ)
    for (const block of lower.blocks) {
      expect(block.size[2]).toBe(staircase.lowerWidth)
      for (const side of [-1, 1]) {
        expect(stairFloorHeight(block.position[0], block.position[2] + side * (staircase.lowerWidth / 2 - 0.05))).toBe(block.top)
      }
    }
    expect(stairRoofs[1].size[2]).toBe(staircase.lowerWidth)
  })
  test('rejects collapsed bends and invalid dimensions', () => {
    expect(() => new StairTurn([0, 0], 0, 1, 2)).toThrow(RangeError)
    expect(() => new StairTurn([Infinity, 0], 0, 2, 1)).toThrow(RangeError)
    expect(() => new CurvedBoxGeometry(3, 1, 2, 1)).toThrow(RangeError)
    expect(() => new CurvedBoxGeometry(3, 1, 1, Number.NaN)).toThrow(RangeError)
  })
})
