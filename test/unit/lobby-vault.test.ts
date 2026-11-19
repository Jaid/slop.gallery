import {afterAll, describe, expect, test} from 'bun:test'

import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallTop} from '../../src/lib/gallery/architecture.ts'
import ArcSlabGeometry from '../../src/lib/gallery/ArcSlabGeometry.ts'
import {getLightingTuning, lightingPresets} from '../../src/lib/gallery/lighting.ts'
import LobbyChandelierGeometry, {lobbyChandelier, lobbyChandelierBottom} from '../../src/lib/gallery/LobbyChandelierGeometry.ts'
import lobbyVault, {glazingStart, lobbyChandeliers, vaultBays, vaultCoffers, vaultHeight, vaultRibs} from '../../src/lib/gallery/lobbyVault.ts'
import LobbyVaultGeometry, {lobbyVaultCollision, roseCenterY} from '../../src/lib/gallery/LobbyVaultGeometry.ts'
import {middaySun, sunClearance, sunDirectionFromAngles, sunGeometry, sunlitPoints} from '../../src/lib/gallery/sun.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import proceduralSky from '../../src/lib/materials/ProceduralSky.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {insideGallery, roomAt, roomClearHeight, rooms} from './fixtures/gallery.ts'
import {expectClosedAndOutward} from './fixtures/geometry.ts'

const room = rooms.find(candidate => candidate.id === 'lobby')!
const halfWidth = room.size[0] / 2
const halfDepth = room.size[1] / 2
const geometry = new LobbyVaultGeometry
const chandelier = new LobbyChandelierGeometry(lobbyChandeliers.anchorY - lobbyChandeliers.y)
const material = new MeshBasicMaterial({side: DoubleSide})
afterAll(() => {
  geometry.dispose()
  chandelier.dispose()
  material.dispose()
})
describe('the Lobby’s barrel vault', () => {
  test('springs from the wall faces on top of the walls and rises to more than twice their height', () => {
    expect(lobbyVault.radius).toBeCloseTo(halfWidth - 0.105, 9)
    expect(lobbyVault.springY).toBe(wallTop)
    expect(lobbyVault.crownY).toBeGreaterThan(2 * wallTop)
    expect(vaultHeight(0)).toBeCloseTo(lobbyVault.crownY, 9)
    expect(vaultHeight(lobbyVault.radius)).toBeCloseTo(lobbyVault.springY, 9)
    expect(roomClearHeight(room)).toBeGreaterThan(lobbyVault.crownY)
    // The space under the vault still counts as the Lobby, so room culling keeps the chandeliers and the vault drawn.
    expect(roomAt([0, lobbyVault.crownY - 1, room.center[1]])).toBe('lobby')
    expect(insideGallery([0, lobbyVault.crownY - 1, room.center[1]])).toBe(true)
    // Rooms with raised roofs have separate clearance tests.
    expect(rooms.filter(other => !['antechamber', 'forge', 'lobby', 'salon', 'vesper'].includes(other.id)).every(other => Math.abs(roomClearHeight(other) - other.height) < 1e-9)).toBe(true)
  })
  test('ribs stand on the 4 m grid of the floor tiles, with wall arches against both end walls', () => {
    const ribs = vaultRibs()
    expect(ribs[0].wallArch).toBe(true)
    expect(ribs.at(-1)!.wallArch).toBe(true)
    const inner = ribs.filter(rib => !rib.wallArch)
    expect(inner.map(rib => rib.z)).toEqual([-16, -12, -8, -4, 0, 4, 8, 12, 16])
    expect(ribs[0].z - lobbyVault.rib.width / 2).toBeCloseTo(-lobbyVault.halfLength, 9)
    expect(ribs.at(-1)!.z + lobbyVault.rib.width / 2).toBeCloseTo(lobbyVault.halfLength, 9)
    for (const [north, south] of vaultBays()) {
      expect(south - north).toBeGreaterThan(lobbyVault.rib.width)
    }
    expect(vaultBays()).toHaveLength(ribs.length - 1)
  })
  test('square coffers line the flanks below the glazing, spaced on their own', () => {
    const {angles, top, z} = vaultCoffers()
    const {coffer, halfLength, radius} = lobbyVault
    expect(top).toBeLessThan(glazingStart)
    expect(angles[0]).toBeCloseTo(coffer.frame / radius, 12)
    expect(angles[1]).toBeCloseTo(top - coffer.frame / radius, 12)
    const side = (angles[1] - angles[0]) * radius
    for (const [north, south] of z) {
      expect(Math.abs(south - north - side)).toBeLessThan(0.3)
    }
    expect(z[0][0]).toBeCloseTo(-halfLength + coffer.frame, 9)
    expect(z.at(-1)![1]).toBeCloseTo(halfLength - coffer.frame, 9)
    expect(z).not.toHaveLength(vaultBays().length)
    expect(glazingStart).toBeGreaterThan(Math.PI / 8)
    expect(glazingStart).toBeLessThan(Math.PI / 2)
  })
  test('stays within the Lobby’s footprint and above its walls', () => {
    for (const part of [geometry.clad, geometry.stone, geometry.plaster, geometry.gold, geometry.bars, geometry.glass, geometry.roseGlass]) {
      const box = part.boundingBox!
      expect(box.min.x).toBeGreaterThanOrEqual(-halfWidth - lobbyVault.shell - 0.25)
      expect(box.max.x).toBeLessThanOrEqual(halfWidth + lobbyVault.shell + 0.25)
      // The lunettes sit on top of the end walls, whose outer faces are half a wall behind the room’s edge.
      expect(box.min.z).toBeGreaterThanOrEqual(-halfDepth - 0.35)
      expect(box.max.z).toBeLessThanOrEqual(halfDepth + 0.35)
      expect(box.min.y).toBeGreaterThanOrEqual(lobbyVault.springY - 1e-6)
      expect(box.max.y).toBeLessThanOrEqual(lobbyVault.crownY + lobbyVault.coffer.depth + lobbyVault.shell + 1e-6)
    }
  })
  test('glass of the crown band spans every bay between the ribs', () => {
    const box = geometry.glass.boundingBox!
    expect(box.min.y).toBeCloseTo(lobbyVault.springY + (lobbyVault.radius + lobbyVault.coffer.depth) * Math.sin(glazingStart), 2)
    expect(box.max.x).toBeCloseTo((lobbyVault.radius + lobbyVault.coffer.depth) * Math.cos(glazingStart), 2)
    expect(roseCenterY + lobbyVault.rose.radius).toBeLessThan(vaultHeight(lobbyVault.rose.radius))
    expect(roseCenterY - lobbyVault.rose.radius).toBeGreaterThan(lobbyVault.springY)
  })
  test('keeps a reasonable triangle budget', () => {
    const total = [geometry.clad, geometry.stone, geometry.plaster, geometry.gold, geometry.bars, geometry.glass, geometry.roseGlass].reduce((sum, part) => sum + triangleCount(part), 0)
    expect(total).toBeLessThan(150_000)
  })
  test('lets the sun in through the glazed crown and nowhere else', () => {
    const meshes = [geometry.clad, geometry.stone, geometry.plaster, geometry.gold, geometry.bars, geometry.roseGlass].map(part => new Mesh(part, material))
    const glass = new Mesh(geometry.glass, material)
    for (const mesh of [...meshes, glass]) {
      mesh.geometry.boundsTree = new MeshBVH(mesh.geometry)
      mesh.raycast = acceleratedRaycast
      mesh.updateMatrixWorld()
    }
    const direction = new Vector3(...middaySun)
    let lit = 0
    let total = 0
    for (let x = -7; x <= 7; x += 1) {
      for (let z = -18; z <= 18; z += 1) {
        const origin = new Vector3(x, 0.1, z)
        // Rays that leave through the walls below the springing are the walls’ business.
        const springing = origin.clone().addScaledVector(direction, (lobbyVault.springY - origin.y) / direction.y)
        if (Math.abs(springing.x) > lobbyVault.radius || Math.abs(springing.z) > lobbyVault.halfLength) {
          continue
        }
        const raycaster = new Raycaster(origin, direction)
        raycaster.firstHitOnly = true
        const blocked = raycaster.intersectObjects(meshes, false).at(0)
        const pane = raycaster.intersectObject(glass, false).at(0)
        total++
        // Light that misses the glass meets the shell of the vault; nothing reaches the floor through a gap.
        expect(blocked ?? pane).toBeDefined()
        if (pane && (!blocked || blocked.distance > pane.distance)) {
          lit++
        }
      }
    }
    // A broad band of sunlight falls on the floor, but bars, ribs and the solid flanks keep most of it in the shade.
    expect(lit / total).toBeGreaterThan(0.15)
    expect(lit / total).toBeLessThan(0.75)
  })
  test('arc slabs are closed, outward-wound solids, from thin shells to narrow ribs and full rings', () => {
    for (const options of [
      {
        radii: [7.9, 8.4],
        angles: [0, Math.PI],
        z: [-0.3, 0.3],
      },
      {
        radii: [0, 2],
        angles: [0, Math.PI * 2],
        z: [0, 0.02],
        segments: 24,
      },
      {
        radii: [1, 1.2],
        angles: [0.2, 0.3],
        z: [0, 4],
        segments: 1,
      },
    ] as const) {
      const slab = new ArcSlabGeometry(options)
      expectClosedAndOutward(slab)
      slab.dispose()
    }
    expect(() => new ArcSlabGeometry({
      radii: [2, 1],
      angles: [0, 1],
      z: [0, 1],
    })).toThrow(RangeError)
  })
  test('a smooth collision shell lines the vault', () => {
    const [vertices, indices] = lobbyVaultCollision()
    expect(indices.length % 3).toBe(0)
    expect(indices.length).toBeGreaterThan(0)
    for (let i = 0; i < vertices.length; i += 3) {
      expect(Math.hypot(vertices[i], vertices[i + 1] - lobbyVault.springY)).toBeGreaterThanOrEqual(lobbyVault.radius - 1e-4)
    }
  })
})
describe('the Lobby’s chandeliers', () => {
  test('hang from the spine, high above the visitors and clear of each other and the end walls', () => {
    const reachOut = Math.max(...lobbyChandelier.tiers.map(tier => tier.radius)) + 0.2
    for (const z of lobbyChandeliers.offsets) {
      expect(Math.abs(z)).toBeLessThan(lobbyVault.halfLength - reachOut)
    }
    expect(lobbyChandeliers.anchorY).toBeCloseTo(lobbyVault.crownY - lobbyVault.rib.depth, 9)
    expect(lobbyChandeliers.y + lobbyChandelierBottom).toBeGreaterThan(7)
    const reach = Math.max(...lobbyChandelier.tiers.map(tier => tier.radius))
    const offsets = lobbyChandeliers.offsets
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i] - offsets[i - 1]).toBeGreaterThan(reach * 2 + 2)
    }
    // The boss meets the spine’s soffit.
    expect(chandelier.gilt.boundingBox!.max.y).toBeCloseTo(lobbyChandeliers.anchorY - lobbyChandeliers.y, 6)
    expect(chandelier.gilt.boundingBox!.min.y).toBeCloseTo(lobbyChandelierBottom, 6)
  })
})
describe('the sun and the sky', () => {
  test('the Noon preset shines the midday sun, and the tuning panel opens with its own angles and intensities', () => {
    const noon = lightingPresets.noon
    const tuning = getLightingTuning(noon)
    expect(noon.sun.direction).toEqual(middaySun)
    expect(tuning.hemisphereIntensity).toBe(noon.hemisphere.intensity)
    expect(tuning.sunIntensity).toBe(noon.sun.intensity)
    const direction = sunDirectionFromAngles(tuning.sunAzimuth, tuning.sunElevation)
    for (const [axis, value] of direction.entries()) {
      expect(value).toBeCloseTo(middaySun[axis], 9)
    }
  })
  test('the shadow map covers every sunlit room, and the vault stays in front of its near plane', () => {
    const points = sunlitPoints(slopGallery.rooms)
    const sun = sunGeometry(middaySun, points)
    const direction = new Vector3(...sun.direction)
    expect(direction.length()).toBeCloseTo(1, 9)
    expect(direction.y).toBeCloseTo(Math.sin(51 * Math.PI / 180), 9)
    const position = new Vector3(...sun.position)
    const forward = direction.clone().negate()
    const worldUp = new Vector3(0, 1, 0)
    const right = worldUp.cross(direction).normalize()
    const up = direction.clone().cross(right)
    for (const corner of points) {
      const offset = new Vector3(...corner)
      offset.sub(position)
      expect(offset.dot(right)).toBeGreaterThan(sun.shadow.left)
      expect(offset.dot(right)).toBeLessThan(sun.shadow.right)
      expect(offset.dot(up)).toBeGreaterThan(sun.shadow.bottom)
      expect(offset.dot(up)).toBeLessThan(sun.shadow.top)
      expect(offset.dot(forward)).toBeGreaterThan(sun.shadow.near)
      expect(offset.dot(forward)).toBeLessThan(sun.shadow.far)
    }
    expect(sunClearance(sun.direction)).toBeGreaterThan(sun.shadow.near)
    expect(points.some(([x, y, z]) => Math.abs(x) < 9 && y > lobbyVault.crownY && Math.abs(z - room.center[1]) < 21)).toBe(true)
  })
  test('the sky validates its options', () => {
    expect(() => proceduralSky({sunDirection: middaySun})).not.toThrow()
    expect(() => proceduralSky({
      sunDirection: middaySun,
      cloudCover: 1.5,
    })).toThrow(RangeError)
    expect(() => proceduralSky({sunDirection: [0, 0, 0]})).toThrow(RangeError)
  })
  test('the end walls stop below the lunettes, which carry their cladding on up to the vault', () => {
    for (const wall of walls) {
      if (wall.room === 'lobby') {
        expect(wall.height + 0.3).toBeCloseTo(lobbyVault.springY, 9)
      }
    }
  })
})
