import type {BufferGeometry} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import forge, {forgeVestibule} from '../../src/lib/gallery/forge.ts'
import {forgeCupola, forgeCupolaHeight, forgeRoof, forgeRoofBays} from '../../src/lib/gallery/forgeRoof.ts'
import ForgeRoofGeometry, {ForgeCupolaGeometry, forgePaneSize} from '../../src/lib/gallery/ForgeRoofGeometry.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import lobbyVault from '../../src/lib/gallery/lobbyVault.ts'
import {middaySun} from '../../src/lib/gallery/sun.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

await RAPIER.init()
const up = new Vector3(0, 1, 0)
const middayDirection = () => {
  const sun = new Vector3(...middaySun)
  return sun.normalize()
}
function collisionWorld(triangles: [Float32Array, Uint32Array]) {
  const world = new RAPIER.World({
    x: 0,
    y: 0,
    z: 0,
  })
  world.createCollider(RAPIER.ColliderDesc.trimesh(...triangles, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
  world.step()
  return world
}
describe('the Forge’s sawtooth roof', () => {
  test('the three clerestories are inside the room’s plan and air, with whole panes between the glazing bars', () => {
    const room = slopGallery.room('forge')
    expect(room.room.sunlit).toBe(true)
    expect(room.room.hasVolumetricSun).toBe(true)
    expect(room.air[0].max.y).toBe(forgeRoof.ridgeY)
    expect(forgeRoofBays).toHaveLength(3)
    expect(forgePaneSize[0] * forgeRoof.paneColumns).toBeCloseTo(forgeRoof.glassHalfWidth * 2, 9)
    expect(forgeRoof.glassHalfWidth).toBeLessThan(forge.size[0] / 2 - forgeRoof.ledge)
    expect(forgeRoof.ledge).toBeGreaterThan(lobbyVault.outerRadius - lobby.width / 2 + 0.1)
    expect(forgeRoof.eaveY).toBeLessThan(lobbyVault.springY)
    for (const {foot, ridge, sill} of forgeRoofBays) {
      expect(foot[1]).toBeLessThan(ridge[1])
      expect(ridge[1]).toBeLessThan(sill[1])
      expect(sill[1]).toBeLessThan(forge.size[1] / 2)
      expect(ridge[0]).toBeGreaterThan(sill[0])
    }
  })
  test('both gable walls have inward unit normals even where they taper into the eave', () => {
    const roof = new ForgeRoofGeometry
    try {
      const x = roof.masonry.getAttribute('position')
      const n = roof.masonry.getAttribute('normal')
      for (let i = 0; i < n.count; i++) {
        expect(n.getX(i)).toBe(-Math.sign(x.getX(i)))
        expect(Math.abs(n.getY(i))).toBe(0)
        expect(Math.abs(n.getZ(i))).toBe(0)
      }
    } finally {
      roof.dispose()
    }
  })
  test('every vertical ray inside the walls hits the visible roof and the collider, including through the glass', () => {
    const roof = new ForgeRoofGeometry
    const material = new MeshBasicMaterial({side: DoubleSide})
    const envelope = [roof.decking, roof.masonry, roof.glass].map(geometry => new Mesh(geometry, material))
    const world = collisionWorld(roof.collision)
    try {
      let glazed = 0
      for (let x = -5.8; x < 5.9; x += 0.4) {
        for (let z = -7.8; z < 7.9; z += 0.23) {
          const origin = new Vector3(x, 0, z)
          const ray = new Raycaster(origin, up)
          const [visible] = ray.intersectObjects(envelope)
          const solid = world.castRay(new RAPIER.Ray(origin, up), 10, true)
          expect(visible).toBeDefined()
          // A truss may hit sooner than the envelope, never after it.
          expect(solid?.timeOfImpact ?? Infinity).toBeLessThanOrEqual(visible.distance + 0.00005)
          if (visible.object === envelope[2] && Math.abs(solid!.timeOfImpact - visible.distance) < 0.00005) {
            glazed++
          }
        }
      }
      expect(glazed).toBeGreaterThan(150)
    } finally {
      world.free()
      roof.dispose()
      material.dispose()
    }
  })
  test('midday sunlight reaches the floor through all three clerestories and never through the opaque envelope', () => {
    const roof = new ForgeRoofGeometry
    const material = new MeshBasicMaterial({side: DoubleSide})
    const glass = new Mesh(roof.glass, material)
    const roofParts = [roof.decking, roof.masonry, roof.iron, roof.copper].map(geometry => new Mesh(geometry, material))
    const walls = slopGallery.walls.filter(wall => wall.room === 'forge' && !wall.curveRadius)
    const owned: Array<BufferGeometry> = []
    for (const wall of walls) {
      const {surface, cornice, trim, glazing} = createArchitectureGeometry(wall)
      for (const geometry of [surface, ...cornice, ...trim, ...glazing]) {
        const mesh = new Mesh(geometry, material)
        mesh.position.set(wall.center[0] - forge.center[0], 0, wall.center[2] - forge.center[1])
        mesh.rotation.y = wall.rotation
        mesh.updateMatrixWorld()
        roofParts.push(mesh)
        owned.push(geometry)
      }
    }
    for (const mesh of [...roofParts, glass]) {
      mesh.geometry.boundsTree = new MeshBVH(mesh.geometry)
      mesh.raycast = acceleratedRaycast
    }
    try {
      const lit = forgeRoofBays.map(() => 0)
      const sun = middayDirection()
      for (let x = -5.7; x < 5.8; x += 0.22) {
        for (let z = -7.7; z < 7.8; z += 0.22) {
          const ray = new Raycaster(new Vector3(x, 0, z), sun)
          ray.firstHitOnly = true
          if (ray.intersectObjects(roofParts).length) {
            continue
          }
          const [pane] = ray.intersectObject(glass)
          expect(pane).toBeDefined()
          const bay = forgeRoofBays.findIndex(({ridge, sill}) => pane.point.z >= ridge[1] && pane.point.z <= sill[1])
          expect(bay).toBeGreaterThanOrEqual(0)
          lit[bay]++
        }
      }
      // At this resolution a hundred samples is just under 5 m².
      expect(lit.reduce((a, b) => a + b, 0)).toBeGreaterThan(100)
      expect(lit.every(count => count > 0)).toBe(true)
    } finally {
      roof.dispose()
      material.dispose()
      for (const geometry of owned) {
        geometry.dispose()
      }
    }
  })
})
describe('the Forge’s vestibule cupola', () => {
  test('a solid segmental cap meets the wall all around and covers the lit pendant', () => {
    const room = slopGallery.room('forge')
    expect(room.air[1].max.y).toBe(forgeCupola.crownY)
    const pendant = room.lamps().find(({id}) => id === 'forge-cupola')!
    expect(pendant.position).toEqual([forgeVestibule.center[0], forgeCupola.lampY, forgeVestibule.center[1]])
    expect(slopGallery.lampRooms(pendant)).toContain('bastion')
    const dome = new ForgeCupolaGeometry
    const material = new MeshBasicMaterial({side: DoubleSide})
    const shell = new Mesh(dome.masonry, material)
    const world = collisionWorld(dome.collision)
    try {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8 + Math.PI / 16
        for (const r of [0.6, 1.5, 2.7, 2.96]) {
          const origin = new Vector3(r * Math.cos(angle), 0, r * Math.sin(angle))
          const ray = new Raycaster(origin, up)
          const [hit] = ray.intersectObject(shell)
          expect(hit.distance).toBeCloseTo(forgeCupolaHeight(r), 2)
          expect(world.castRay(new RAPIER.Ray(origin, up), 10, true)?.timeOfImpact).toBeCloseTo(hit.distance, 4)
        }
      }
    } finally {
      world.free()
      dome.dispose()
      material.dispose()
    }
  })
})
