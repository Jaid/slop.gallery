import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Frustum, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector3} from 'three/webgpu'

import {wallFace, wallTop} from '../../src/lib/gallery/architecture.ts'
import lobbyVault from '../../src/lib/gallery/lobbyVault.ts'
import {portals, visibleRooms} from '../../src/lib/gallery/roomVisibility.ts'
import {middaySun} from '../../src/lib/gallery/sun.ts'
import VesperBridgeGeometry from '../../src/lib/gallery/VesperBridgeGeometry.ts'
import vesperCeiling, {vesperCoveEnd, vesperCoveSection, vesperCoveTopY, vesperLanternEavesY, vesperLanternHalf, vesperLanternRidgeY, vesperLanternSillY, vesperOpeningInset} from '../../src/lib/gallery/vesperCeiling.ts'
import VesperCeilingGeometry, {vesperCeilingCollision} from '../../src/lib/gallery/VesperCeilingGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import walls, {roomAt, roomClearHeight, rooms} from './fixtures/gallery.ts'
import {expectClosedAndOutward} from './fixtures/geometry.ts'

const room = rooms.find(candidate => candidate.id === 'vesper')!
const lobby = rooms.find(candidate => candidate.id === 'lobby')!
const [faceX, faceZ] = room.size.map(size => size / 2 - wallFace)
const [halfX, halfZ] = vesperLanternHalf(room.size)
const {rise} = vesperCeiling.lantern
await RAPIER.init()
const geometry = new VesperCeilingGeometry(room.size)
const bridge = new VesperBridgeGeometry(room.size)
const bridgeParts = [bridge.deck, bridge.bronze, bridge.gilt]
const material = new MeshBasicMaterial({side: DoubleSide})
afterAll(() => {
  geometry.dispose()
  bridge.dispose()
  material.dispose()
})
const parts = [geometry.plaster, geometry.gilt, geometry.bars, geometry.glass, ...bridgeParts]
const vectorAt = (attribute: ReturnType<typeof geometry.plaster.getAttribute>, index: number) => {
  const vector = new Vector3
  return vector.fromBufferAttribute(attribute, index)
}
const vertices = (part: typeof geometry.plaster) => {
  const position = part.getAttribute('position')
  return Array.from({length: position.count}, (_, index) => vectorAt(position, index))
}
/** height of the lantern’s hipped roof over the point on the plan */
const roofY = (x: number, z: number) => vesperLanternEavesY + rise * Math.min(halfX - Math.abs(x), halfZ - Math.abs(z)) / halfX
const fromBelow = (x: number, z: number) => new Raycaster(new Vector3(x, 5, z), new Vector3(0, 1, 0))
const view = (position: Vec3, target: Vec3) => {
  const camera = new PerspectiveCamera(62, 16 / 9, 0.05, 90)
  camera.position.set(...position)
  camera.lookAt(...target)
  camera.updateMatrixWorld()
  const matrix = new Matrix4
  const frustum = new Frustum
  return frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
}
describe('the Vesper’s coved ceiling', () => {
  test('rises from the top of the walls through the cove and the curb to the lantern’s ridge, the room’s highest point', () => {
    expect(vesperCeiling.springY).toBe(wallTop)
    for (const wall of walls) {
      if (wall.room === 'vesper') {
        expect(wall.height + 0.3).toBeCloseTo(vesperCeiling.springY, 9)
      }
    }
    const foot = vesperCoveSection(0)
    const top = vesperCoveSection(Math.PI / 2)
    expect(foot.point).toEqual([vesperCeiling.ledge, vesperCeiling.springY])
    expect(foot.normal[0]).toBeCloseTo(1, 9)
    expect(top.point[0]).toBeCloseTo(vesperCoveEnd, 9)
    expect(top.point[1]).toBeCloseTo(vesperCoveTopY, 9)
    expect(top.normal[1]).toBeCloseTo(-1, 9)
    // A flat band frames the opening between the cove and the curb.
    expect(vesperOpeningInset - vesperCoveEnd).toBeGreaterThan(vesperCeiling.gilt.fillet * 2)
    expect(vesperCoveTopY).toBeLessThan(vesperLanternSillY)
    expect(vesperLanternSillY).toBeLessThan(vesperLanternEavesY)
    expect(vesperLanternEavesY).toBeLessThan(vesperLanternRidgeY)
    expect(roomClearHeight(room)).toBeCloseTo(vesperLanternRidgeY, 9)
    expect(roomAt([room.center[0], vesperLanternRidgeY - 0.3, room.center[1]])).toBe('vesper')
  })
  test('opens into a lantern of whole panes, whose hipped roof has a ridge along the room', () => {
    const {pane} = vesperCeiling.lantern
    expect(halfX).toBeCloseTo(faceX - vesperOpeningInset, 9)
    expect(halfZ).toBeCloseTo(faceZ - vesperOpeningInset, 9)
    for (const half of [halfX, halfZ]) {
      expect(half * 2 / pane % 1).toBeCloseTo(0, 9)
    }
    expect(halfZ).toBeGreaterThan(halfX)
    expect(() => vesperLanternHalf([12, 10])).toThrow(RangeError)
  })
  test('keeps the cove and its gilding clear of the Lobby vault’s shell, which overhangs the wall the two rooms share', () => {
    // The Vesper’s east wall face, measured from the axis of the Lobby’s vault.
    const distance = lobby.center[0] - (room.center[0] + faceX)
    expect(distance).toBeCloseTo(lobbyVault.halfSpan + wallFace * 2, 9)
    /** how far the shell reaches past the Vesper’s east wall face at the height */
    const overhang = (y: number) => Math.sqrt(Math.max(0, lobbyVault.outerRadius ** 2 - (y - lobbyVault.springY) ** 2)) - distance
    expect(overhang(lobbyVault.springY)).toBeGreaterThan(0.3)
    for (let index = 0; index <= 100; index++) {
      const {point: [inward, y]} = vesperCoveSection(index / 100 * Math.PI / 2)
      expect(inward).toBeGreaterThan(overhang(y) + 0.05)
    }
    for (const {x, y} of vertices(geometry.gilt)) {
      expect(faceX - x).toBeGreaterThan(overhang(y))
    }
  })
  test('stays inside the walls’ faces, above their cornice and below the ridge', () => {
    for (const part of parts) {
      const {min, max} = part.boundingBox!
      expect(Math.max(-min.x, max.x)).toBeLessThanOrEqual(faceX + 1e-6)
      expect(Math.max(-min.z, max.z)).toBeLessThanOrEqual(faceZ + 1e-6)
      expect(min.y).toBeGreaterThan(vesperCeiling.springY - 0.06)
      expect(max.y).toBeLessThanOrEqual(vesperLanternRidgeY + 1e-6)
    }
  })
  test('the plaster shell is a closed solid', () => {
    expectClosedAndOutward(geometry.plaster)
  })
  test('the lantern’s bronze stays inside its glass', () => {
    for (const {x, y, z} of vertices(geometry.bars)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(halfX + 1e-5)
      expect(Math.abs(z)).toBeLessThanOrEqual(halfZ + 1e-5)
      expect(y).toBeGreaterThanOrEqual(vesperLanternSillY - 1e-5)
      expect(y).toBeLessThanOrEqual(roofY(x, z) + 1e-5)
    }
  })
  test('the glass faces into the lantern, counting its panes in its UVs', () => {
    const position = geometry.glass.getAttribute('position')
    const normal = geometry.glass.getAttribute('normal')
    const uv = geometry.glass.getAttribute('uv')
    const center = new Vector3(0, vesperLanternSillY, 0)
    for (let index = 0; index < position.count; index++) {
      const corner = vectorAt(position, index)
      expect(vectorAt(normal, index).dot(center.clone().sub(corner))).toBeGreaterThan(0)
      // Corners of the glass lie on the joints between panes, where the bars run.
      for (const value of [uv.getX(index), uv.getY(index)]) {
        expect(Math.abs(value - Math.round(value))).toBeLessThan(1e-5)
      }
    }
  })
  test('keeps a modest triangle budget', () => {
    expect(parts.reduce((sum, part) => sum + triangleCount(part), 0)).toBeLessThan(20_000)
  })
  test('lets the sun in through the lantern and nowhere else', () => {
    const opaque = [geometry.plaster, geometry.gilt, geometry.bars, ...bridgeParts].map(part => new Mesh(part, material))
    const glass = new Mesh(geometry.glass, material)
    for (const mesh of [...opaque, glass]) {
      mesh.geometry.boundsTree = new MeshBVH(mesh.geometry)
      mesh.raycast = acceleratedRaycast
      mesh.updateMatrixWorld()
    }
    const direction = new Vector3(...middaySun)
    let lit = 0
    let total = 0
    for (let x = -5.5; x <= 5.5; x += 0.5) {
      for (let z = -7.5; z <= 7.5; z += 0.5) {
        const origin = new Vector3(x, 0.1, z)
        // Rays that leave through the walls below the ceiling are the walls’ business.
        const springing = origin.clone().addScaledVector(direction, (vesperCeiling.springY - origin.y) / direction.y)
        if (Math.abs(springing.x) > faceX || Math.abs(springing.z) > faceZ) {
          continue
        }
        const raycaster = new Raycaster(origin, direction)
        raycaster.firstHitOnly = true
        const blocked = raycaster.intersectObjects(opaque, false).at(0)
        const pane = raycaster.intersectObject(glass, false).at(0)
        total++
        // Light that misses the glass meets the ceiling; nothing reaches the floor through a gap.
        expect(blocked ?? pane).toBeDefined()
        if (pane && !blocked) {
          lit++
        }
      }
    }
    expect(total).toBeGreaterThan(100)
    // A patch of sunlight falls into the room, crossed by the shadows of the bars.
    expect(lit / total).toBeGreaterThan(0.15)
    expect(lit / total).toBeLessThan(0.75)
  })
  test('a smooth collision surface lines the ceiling and the lantern', () => {
    const [positions, indices] = vesperCeilingCollision(room.size)
    expect(indices.length % 3).toBe(0)
    expect(indices.length).toBeGreaterThan(0)
    for (let index = 0; index < positions.length; index += 3) {
      expect(Math.abs(positions[index])).toBeLessThanOrEqual(faceX + 1e-5)
      expect(positions[index + 1]).toBeGreaterThanOrEqual(vesperCeiling.springY - 1e-5)
      expect(Math.abs(positions[index + 2])).toBeLessThanOrEqual(faceZ + 1e-5)
    }
  })
  test('the arch divides the opening from curb to curb without blocking either half', () => {
    const [arch, ...trim] = bridgeParts.map(part => new Mesh(part, material))
    const glass = new Mesh(geometry.glass, material)
    for (const x of [-halfX + 0.01, -2, -1, 0, 1, 2, halfX - 0.01]) {
      for (const z of [-0.69, 0, 0.69]) {
        expect(fromBelow(x, z).intersectObject(arch)[0]?.point.y).toBeLessThan(vesperCoveTopY)
      }
      for (const z of [1, 4, halfZ - 0.01]) {
        for (const side of [-1, 1]) {
          const ray = fromBelow(x, side * z)
          expect(ray.intersectObjects([arch, ...trim])).toHaveLength(0)
          expect(ray.intersectObject(glass)[0]?.point.y).toBeCloseTo(roofY(x, z), 5)
        }
      }
    }
    const crown = fromBelow(0, 0).intersectObject(arch)[0].point.y
    const springing = fromBelow(halfX - 0.01, 0).intersectObject(arch)[0].point.y
    expect(crown - springing).toBeGreaterThan(0.45)
  })
  test('the bridge stays clear of the lantern’s glass', () => {
    for (const part of bridgeParts) {
      for (const {x, y, z} of vertices(part)) {
        if (!(y > vesperLanternSillY)) {
          continue
        }
        expect(Math.abs(x)).toBeLessThan(halfX)
        expect(Math.abs(z)).toBeLessThan(halfZ)
        expect(y).toBeLessThan(roofY(x, z))
      }
    }
  })
  test('the bridge’s deck, arch and handrails collide where they are drawn', () => {
    const arch = new Mesh(bridge.deck, material)
    const rail = new Mesh(bridge.bronze, material)
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    try {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...bridge.collision, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
      world.step()
      const check = (mesh: Mesh, origin: Vector3, direction: Vector3) => {
        const ray = new Raycaster(origin, direction)
        const visible = ray.intersectObject(mesh)[0]
        const physical = world.castRay(new RAPIER.Ray(origin, direction), 3, true)
        expect(physical?.timeOfImpact).toBeCloseTo(visible.distance, 5)
      }
      for (const x of [-2.9, -2, -1, 0, 1, 2, 2.9]) {
        check(arch, new Vector3(x, 8, 0), new Vector3(0, -1, 0))
        check(arch, new Vector3(x, 6, 0), new Vector3(0, 1, 0))
      }
      for (const side of [-1, 1]) {
        check(rail, new Vector3(0.15, 8.32, side * 1.5), new Vector3(0, 0, -side))
      }
      expect(world.castRay(new RAPIER.Ray(new Vector3(0, 6, 1.3), new Vector3(0, 1, 0)), 3, true)).toBeNull()
    } finally {
      world.free()
    }
  })
  test('the lantern shows the Lobby’s vault rising next door', () => {
    expect(portals.some(portal => portal.rooms.includes('vesper') && portal.rooms.includes('lobby') && portal.box.min.y > vesperCeiling.springY)).toBe(true)
    // Looking steeply up at the lantern’s east side, with the door to the Lobby far below the view.
    expect(visibleRooms('vesper', view([room.center[0], 1.6, room.center[1]], [room.center[0] + halfX, vesperLanternEavesY, room.center[1]])).has('lobby')).toBe(true)
  })
})
