import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architecture.ts'
import salon from '../../src/lib/gallery/salon.ts'
import salonRoof, {salonGlassY, salonRoofTopY} from '../../src/lib/gallery/salonRoof.ts'
import SalonRoofGeometry, {salonRoofFinish} from '../../src/lib/gallery/SalonRoofGeometry.ts'
import {middaySun} from '../../src/lib/gallery/sun.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {roomClearHeight, rooms} from './fixtures/gallery.ts'

const roof = new SalonRoofGeometry(salon.size)
const material = new MeshBasicMaterial({side: DoubleSide})
const plaster = new Mesh(roof.plaster, material)
const glass = new Mesh(roof.glass, material)
const bronze = new Mesh(roof.bars, material)
const up = new Vector3(0, 1, 0)
const over = (x: number, z: number) => new Raycaster(new Vector3(x, 3, z), up)
const room = rooms.find(candidate => candidate.id === 'salon')!
const {opening, petals, spring, springY} = salonRoof
afterAll(() => {
  roof.dispose()
  material.dispose()
})
describe('the Salon’s roof', () => {
  test('sits on the walls, rises above the cornice and fits in the room’s air bounds', () => {
    expect(roomClearHeight(room)).toBe(salonRoofTopY)
    roof.plaster.computeBoundingBox()
    const {min, max} = roof.plaster.boundingBox!
    expect([max.x - min.x, max.z - min.z]).toEqual([...salon.size])
    expect(min.y).toBeGreaterThan(springY - 0.035)
    expect(max.y).toBeCloseTo(salonRoofTopY, 5)
    const [halfX, halfZ] = room.size.map(value => value / 2 - wallFace)
    for (const x of [-halfX, halfX]) {
      for (const z of [-halfZ, halfZ]) {
        const hit = over(x, z).intersectObject(plaster)[0]
        expect(hit.point.y).toBeCloseTo(springY, 5)
        expect(hit.face?.normal.y).toBeCloseTo(-1, 5)
      }
    }
    const hits = over(0.5 * (spring[0] + opening[0]), 0).intersectObject(plaster)
    expect(hits[0].point.y).toBeGreaterThan(springY + 0.4)
    expect(hits.at(-1)!.point.y - hits[0].point.y).toBeGreaterThan(0.08)
    expect(over(0, 0).intersectObject(plaster)).toHaveLength(0)
    expect(over(0, 0).intersectObject(glass)[0].point.y).toBeCloseTo(salonGlassY, 5)
    const groups = roof.plaster.groups
    expect(groups.reduce((count, group) => count + group.count, 0)).toBe(roof.plaster.index!.count)
    expect(new Set(groups.map(group => group.materialIndex))).toEqual(new Set(Object.values(salonRoofFinish)))
    expect([roof.plaster, roof.bars, roof.glass].reduce((sum, part) => sum + triangleCount(part), 0)).toBeLessThan(22_000)
  })
  test('the raised cove has modeled flutes, not just painted stripes', () => {
    const [x, z] = spring.map((half, axis) => (half + opening[axis] + 0.15) / 2)
    const ridge = over(x, 0).intersectObject(plaster)[0]
    const angle = Math.PI / salonRoof.flutes
    const valley = over(x * Math.cos(angle), z * Math.sin(angle)).intersectObject(plaster)[0]
    expect(ridge.point.y - valley.point.y).toBeGreaterThan(0.1)
  })
  test('the collider follows the saucer and seals the glazing all the way around its rim', async () => {
    const [vertices, indices] = roof.collision
    const edges = new Map<number, number>
    // The rim is welded, so only the perimeter at the walls has any edges with one incident face.
    const count = vertices.length / 3
    for (let i = 0; i < indices.length; i += 3) {
      for (let corner = 0; corner < 3; corner++) {
        const a = indices[i + corner]
        const b = indices[i + (corner + 1) % 3]
        const edge = Math.min(a, b) * count + Math.max(a, b)
        edges.set(edge, (edges.get(edge) ?? 0) + 1)
      }
    }
    for (const [edge, faces] of edges) {
      if (faces !== 1) {
        continue
      }
      for (const point of [Math.floor(edge / count), edge % count]) {
        const x = vertices[point * 3]
        const z = vertices[point * 3 + 2]
        expect(Math.abs(x) === salon.size[0] / 2 || Math.abs(z) === salon.size[1] / 2).toBe(true)
      }
    }
    await RAPIER.init()
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    try {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...roof.collision, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
      world.step()
      for (const fraction of [0, 0.8, 0.999, 1.001, 1.15, 1.32]) {
        for (let index = 0; index < 32; index++) {
          const angle = (index + 0.13) * Math.PI / 16
          const ray = over(opening[0] * Math.cos(angle) * fraction, opening[1] * Math.sin(angle) * fraction)
          const rendered = ray.intersectObjects([plaster, glass])[0]
          const physical = world.castRay(new RAPIER.Ray(ray.ray.origin, ray.ray.direction), 4, true)
          expect(physical?.timeOfImpact).toBeCloseTo(rendered.distance, 4)
        }
      }
    } finally {
      world.free()
    }
  })
  test('the noon sun finds open panes between all eight petals and paints the outer ring inside the room', () => {
    const sun = new Vector3(...middaySun)
    const rayThrough = (radius: number, angle: number) => {
      // Project a point in the metalwork onto the floor along the actual sun direction.
      const y = salonGlassY - 0.035
      const projected = new Vector3(opening[0] * radius * Math.cos(angle), y, opening[1] * radius * Math.sin(angle))
      const floor = projected.addScaledVector(sun, -y / sun.y)
      expect(Math.abs(floor.x)).toBeLessThan(room.size[0] / 2 - wallFace)
      expect(Math.abs(floor.z)).toBeLessThan(room.size[1] / 2 - wallFace)
      const ray = new Raycaster(floor, sun)
      expect(ray.intersectObject(glass)).not.toHaveLength(0)
      return ray.intersectObjects([plaster, bronze])[0]?.object
    }
    for (let index = 0; index < petals; index++) {
      const angle = Math.PI * 2 / petals * index
      expect(rayThrough(0.43, angle)).toBe(bronze)
      expect(rayThrough(0.43, angle + Math.PI / petals)).toBeUndefined()
    }
    expect(rayThrough(0, 0)).toBeUndefined()
    for (const angle of [0, Math.PI / 2, Math.PI]) {
      expect(rayThrough(salonRoof.border, angle)).toBe(bronze)
      expect(rayThrough(0.91, angle)).toBeUndefined()
    }
  })
})
