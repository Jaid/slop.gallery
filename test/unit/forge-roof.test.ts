import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallFace, wallTop} from '../../src/lib/gallery/architecture.ts'
import forge, {forgeBays, forgeRoof, forgeVestibule} from '../../src/lib/gallery/forge.ts'
import ForgeRoofGeometry from '../../src/lib/gallery/forge/ForgeRoofGeometry.ts'
import lobbyVault from '../../src/lib/gallery/lobbyVault.ts'
import {middaySun} from '../../src/lib/gallery/sun.ts'
import {triangleCount} from '../../src/lib/geometry.ts'

await RAPIER.init()
const {eave, ridge} = forgeRoof
const up = new Vector3(0, 1, 0)
const sun = new Vector3(...middaySun)
for (const kind of ['sawtooth', 'hood'] as const) {
  describe(`the Forge’s ${kind} roof`, () => {
    const geometry = new ForgeRoofGeometry(kind)
    const material = new MeshBasicMaterial({side: DoubleSide})
    const meshes = Object.entries(geometry.surfaces).map(([name, surface]) => {
      const mesh = new Mesh(surface, material)
      mesh.name = name
      surface.boundsTree = new MeshBVH(surface)
      mesh.raycast = acceleratedRaycast
      return mesh
    })
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    for (const [vertices, indices] of geometry.collision) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
    }
    world.step()
    afterAll(() => {
      geometry.dispose()
      material.dispose()
      world.free()
    })
    const y = 0.01
    const hit = (x: number, z: number, dir = up) => {
      const ray = new Raycaster(new Vector3(x, y, z), dir, 0, 15)
      return ray.intersectObjects(meshes, false)[0]
    }
    test('has a physical surface at the first visible surface, including the glass, not a flat lid cutting off the space below it', () => {
      let hits = 0
      const finishes = new Set<string>
      for (let x = -forge.size[0] / 2 + 0.36; x < forge.size[0] / 2; x += 0.61) {
        for (let z = -forge.size[1] / 2 + 0.28; z < forge.size[1] / 2; z += 0.49) {
          if (kind === 'hood' && Math.hypot(x, z) > forgeVestibule.radius - 0.09) {
            continue
          }
          const visible = hit(x, z)
          expect(visible).toBeDefined()
          const solid = world.castRay(new RAPIER.Ray({
            x,
            y,
            z,
          }, up), 15, true)
          expect(solid?.timeOfImpact).toBeCloseTo(visible.distance, 3)
          finishes.add(visible.object.name)
          hits++
        }
      }
      expect(hits).toBeGreaterThan(70)
      expect(finishes.has('glass') && finishes.has('deck') && finishes.has('frame')).toBe(true)
    })
    test('keeps a reasonable triangle budget', () => {
      const total = Object.values(geometry.surfaces).reduce((sum, surface) => sum + triangleCount(surface), 0)
      expect(total).toBeLessThan(kind === 'sawtooth' ? 16_000 : 2000)
    })
    test('lets the midday sun onto the floor through nothing but its glass, never through a gap between its parts', () => {
      const [halfX, halfZ] = kind === 'hood' ? [forgeVestibule.radius, forgeVestibule.radius] : [forge.size[0] / 2, forge.size[1] / 2]
      const inside = (x: number, z: number) => (kind === 'hood' ? Math.hypot(x, z) < forgeVestibule.radius - wallFace : Math.abs(x) < halfX - wallFace && Math.abs(z) < halfZ - wallFace)
      let lit = 0
      let total = 0
      for (let x = -halfX + 0.05; x < halfX; x += 0.1) {
        for (let z = -halfZ + 0.05; z < halfZ; z += 0.1) {
          const origin = new Vector3(x, y, z)
          // Rays that leave through the walls below their tops are the walls’ business.
          const top = origin.clone().addScaledVector(sun, (wallTop - y) / sun.y)
          if (!inside(x, z) || !inside(top.x, top.z)) {
            continue
          }
          const raycaster = new Raycaster(origin, sun, 0, 30)
          const crossed = raycaster.intersectObjects(meshes, false)
          expect(crossed.length).toBeGreaterThan(0)
          total++
          // Only the opaque finishes cast shadows, so the sun gets through wherever it crosses nothing but glass.
          if (crossed.every(({object}) => object.name === 'glass')) {
            lit++
          }
        }
      }
      expect(total).toBeGreaterThan(0)
      if (kind === 'sawtooth') {
        // Broad bands of sunlight fall through the lights, while the girders, bars and sheeted pitches shade the rest.
        expect(lit / total).toBeGreaterThan(0.2)
        expect(lit / total).toBeLessThan(0.6)
      }
    })
    if (kind === 'sawtooth') {
      test('the east gables clear the springing of the Lobby vault and the bearer closes the setback below them', () => {
        const east = geometry.surfaces.deck.boundingBox!.max.x
        expect(forge.center[0] + east).toBeLessThan(-lobbyVault.outerRadius)
        expect(hit((forge.size[0] / 2 + east) / 2, 0).object.name).toBe('frame')
      })
      test('each bay climbs on the opaque pitch and descends on the wired glass; the southern lights admit midday sun between the bars', () => {
        for (const {north, peak, south} of forgeBays) {
          for (const [at, expected, finish] of [[north + 0.32 * (peak - north), eave + 0.32 * (ridge - eave), 'deck'], [peak + 0.3 * (south - peak), ridge - 0.3 * (ridge - eave), 'glass']] as const) {
            const overhead = hit(0.7, at)
            expect(overhead.object.name).toBe(finish)
            expect(overhead.point.y).toBeCloseTo(expected, 5)
          }
        }
        for (const {peak, south} of forgeBays.slice(1)) {
          const target = new Vector3(0.7, (eave + ridge) / 2, (peak + south) / 2)
          // Probe a patch and a glazing bar’s shadow next to it, on the floor beneath this particular light.
          const finishes = new Set<string>
          for (let z = -0.3; z <= 0.3; z += 0.04) {
            const ground = target.clone().addScaledVector(sun, -(target.y - y) / sun.y)
            finishes.add(hit(ground.x, ground.z + z, sun).object.name)
          }
          expect([...finishes].toSorted()).toEqual(['frame', 'glass'])
        }
      })
    } else {
      test('the hub caps the eye and each folded gore closes onto it without an open annular seam', () => {
        for (const fraction of [0.17, 0.42]) {
          const angle = fraction * Math.PI / 16
          for (const r of [0, 0.202, 0.21, 0.227, 0.4, 1.312, 1.35, 1.43, 2.3, 2.88]) {
            expect(hit(r * Math.cos(angle), r * Math.sin(angle))).toBeDefined()
          }
        }
      })
    }
  })
}
