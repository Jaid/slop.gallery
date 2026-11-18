import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {portals} from '../../src/lib/gallery/roomVisibility.ts'
import salon, {salonCeiling, salonSkylight} from '../../src/lib/gallery/salon.ts'
import SalonCeilingGeometry from '../../src/lib/gallery/SalonCeilingGeometry.ts'
import {middaySun} from '../../src/lib/gallery/sun.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {roomClearHeight, rooms} from './fixtures/gallery.ts'
import {expectClosedAndOutward} from './fixtures/geometry.ts'

await RAPIER.init()
const geometry = new SalonCeilingGeometry
const material = new MeshBasicMaterial({side: DoubleSide})
const [shell, bars, glass] = [geometry.shell, geometry.laylight.bronze, geometry.laylight.glass].map(part => {
  const mesh = new Mesh(part, material)
  part.boundsTree = new MeshBVH(part)
  mesh.raycast = acceleratedRaycast
  return mesh
})
afterAll(() => {
  geometry.dispose()
  material.dispose()
})
const {glassY, radii: [rx, rz]} = salonSkylight
const [halfWidth, halfDepth] = salon.size.map(extent => extent / 2)
const up = new Vector3(0, 1, 0)
test('the fluted shell is solid, reaches the cornices and rises from its bead to the oval window', () => {
  expectClosedAndOutward(geometry.shell)
  const {min, max} = geometry.shell.boundingBox!
  expect([max.x - min.x, max.z - min.z]).toEqual([...salon.size])
  expect(min.y).toBeCloseTo(salonSkylight.footY, 5)
  expect(max.y).toBeGreaterThan(glassY)
  expect(geometry.laylight.bronze.boundingBox!.max.y).toBeLessThanOrEqual(glassY + 1e-6)
  expect([shell, bars, glass].reduce((count, mesh) => count + triangleCount(mesh.geometry), 0)).toBeLessThan(18_000)
})
test('cut panes tile the opening exactly once, and Rapier closes the room at the actual glass, bronze and stucco', () => {
  const world = new RAPIER.World(new Vector3)
  try {
    for (const args of geometry.colliders) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...args, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
    }
    world.step()
    for (let x = 0.06 - halfWidth; x < halfWidth; x += 0.16) {
      for (let z = 0.13 - halfDepth; z < halfDepth; z += 0.18) {
        const ray = new Raycaster(new Vector3(x, 0, z), up)
        const r = Math.hypot(x / rx, z / rz)
        const panes = ray.intersectObject(glass)
        // The silhouette is a polygon inscribed in the design ellipse.
        if (Math.abs(r - 1) > 0.001) {
          expect(panes).toHaveLength(r < 1 ? 1 : 0)
        }
        expect(Boolean(ray.intersectObject(shell).length)).toBe(!panes.length)
        const first = ray.intersectObjects([shell, bars, glass])[0]
        const physical = world.castRay(new RAPIER.Ray(ray.ray.origin, up), 10, true)
        expect(physical?.timeOfImpact).toBeCloseTo(first.distance, 4)
      }
    }
  } finally {
    world.free()
  }
})
test('the midday sun reaches the floor through the leaves and casts their tracery across it', () => {
  const sun = new Vector3(...middaySun)
  let bright = 0
  let tracery = 0
  let surround = 0
  // Cast from within the room through the whole light well, counting only rays that would reach the glass plane inside the room.
  for (let x = 0.17 - halfWidth; x < halfWidth; x += 0.16) {
    for (let z = 0.12 - halfDepth; z < halfDepth; z += 0.17) {
      const from = new Vector3(x, 0.05, z)
      const at = from.clone().addScaledVector(sun, (glassY - from.y) / sun.y)
      if (Math.abs(at.x) >= halfWidth || Math.abs(at.z) >= halfDepth) {
        continue
      }
      const ray = new Raycaster(from, sun)
      ray.firstHitOnly = true
      if (ray.intersectObject(shell).length) {
        surround++
      } else {
        // No light leaks around the dish.
        expect(ray.intersectObject(glass)).toHaveLength(1)
        if (ray.intersectObject(bars).length) {
          tracery++
        } else {
          bright++
        }
      }
    }
  }
  // A broad patch of light, with a legible shadow pattern inside it rather than just a bright oval.
  expect(bright / (bright + tracery + surround)).toBeGreaterThan(0.19)
  expect(surround).toBeGreaterThan(bright)
  expect(tracery / (tracery + bright)).toBeWithin(0.08, 0.28)
})
test('culling includes the raised laylight and the neighboring Lobby vault seen through it, also in the floor mirror', () => {
  const room = rooms.find(candidate => candidate.id === 'salon')!
  expect(room.room.hasVolumetricSun).toBe(true)
  expect(roomClearHeight(room)).toBeCloseTo(glassY, 6)
  expect(roomClearHeight(room)).toBeGreaterThan(salonCeiling.underside)
  for (const y of [glassY, -glassY]) {
    expect(portals.some(({box, rooms: pair}) => pair.includes('salon') && pair.includes('lobby') && box.containsPoint(new Vector3(room.center[0] + rx, y, room.center[1] + rz)))).toBe(true)
  }
})
