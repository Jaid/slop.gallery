import {describe, expect, test} from 'bun:test'

import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {floorGlassThickness} from '../../src/lib/gallery/floors.ts'
import forge from '../../src/lib/gallery/forge.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {forgeWindow, lobbyWindowGlassDistance, salonWindow} from '../../src/lib/gallery/lobbyWindows.ts'
import salon from '../../src/lib/gallery/salon.ts'
import {createArchitecturalGlassMaterials, disposeArchitecturalGlassMaterials} from '../../src/lib/materials/ArchitecturalGlassMaterials.ts'
import CastFloorGlassMaterial from '../../src/lib/materials/CastFloorGlassMaterial.ts'
import {insideOpening, placementIssue, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls, {galleryPlacement, rooms} from './fixtures/gallery.ts'
import samplePortraits from './fixtures/portraits.ts'

const wallById = (id: string) => walls.find(wall => wall.id === id)!
/** both glass walls, each with the room beside the Lobby, its wall and the Lobby’s, and which way along x the room lies from the Lobby */
const windows = [
  {
    title: 'Salon',
    glazing: salonWindow,
    layout: salon,
    room: rooms.find(room => room.id === 'salon')!,
    roomSide: wallById('salon-west'),
    lobbySide: wallById('lobby-extension_east'),
    out: 1,
  },
  {
    title: 'Forge',
    glazing: forgeWindow,
    layout: forge,
    room: rooms.find(room => room.id === 'forge')!,
    roomSide: wallById('forge-east'),
    lobbySide: wallById('lobby-extension_west'),
    out: -1,
  },
] as const
test('the Forge’s glass wall mirrors the Salon’s across the Lobby', () => {
  expect(forgeWindow).toEqual({
    ...salonWindow,
    x: -salonWindow.x,
  })
})
for (const {title, glazing, layout, room, roomSide, lobbySide, out} of windows) {
  const windowCenter = [glazing.x, (glazing.bottom + glazing.top) / 2, glazing.z] as const
  describe(`the glass wall between the Lobby and the ${title}`, () => {
    test('lines up with the floor window, edge to edge along z', () => {
      expect(glazing.z - glazing.width / 2).toBe(lobby.opening.center[1] - lobby.opening.size[1] / 2)
      expect(glazing.z + glazing.width / 2).toBe(lobby.opening.center[1] + lobby.opening.size[1] / 2)
      // Whole pavers fill both, so their joints meet at the wall.
      expect(glazing.width / glazing.tileSize % 1).toBe(0)
      expect((glazing.top - glazing.bottom) / glazing.tileSize % 1).toBe(0)
      expect(lobby.opening.size[0] / glazing.tileSize % 1).toBe(0)
    })
    test(`stands centered in the ${title}, cut through both walls`, () => {
      expect(glazing.x).toBe(out * lobby.width / 2)
      expect(room.center[1]).toBe(glazing.z)
      expect(room.center[0] - out * room.size[0] / 2).toBe(glazing.x)
      // The room reaches from the Lobby’s north wall as far south of the window.
      expect(room.center[1] - room.size[1] / 2).toBe(lobby.northZ)
      expect(room.center).toEqual([layout.center[0], layout.center[1]])
      for (const wall of [lobbySide, roomSide]) {
        expect(wall.center[0]).toBe(glazing.x)
        expect(wallPosition(wall, wall.holes![0].u, 0)[2]).toBeCloseTo(glazing.z, 12)
        expect(wall.holes).toHaveLength(1)
        const [hole] = wall.holes!
        expect(hole.u).toBeCloseTo(wall === roomSide ? 0 : wallCoordinates(wall, [...windowCenter]), 12)
        expect(hole.width).toBe(glazing.width)
        expect(insideOpening(hole, wallCoordinates(wall, [...windowCenter]), windowCenter[1])).toBe(true)
        // The sill stays above the Salon’s chair rail and its frame below the cornice.
        expect(hole.bottom).toBe(glazing.bottom)
        expect(hole.height).toBe(glazing.top)
        expect(wall.height - hole.height).toBeGreaterThan(0.6)
      }
    })
    test('is cut through both walls, leaving glass where the wall was', () => {
      const material = new MeshBasicMaterial
      const geometries = [lobbySide, roomSide].map(createArchitectureGeometry)
      const meshes = geometries.flatMap((geometry, i) => [geometry.surface, ...geometry.trim].map(part => {
        const wall = [lobbySide, roomSide][i]
        const mesh = new Mesh(part, material)
        mesh.position.set(...wall.center)
        mesh.rotation.y = wall.rotation
        mesh.updateMatrixWorld(true)
        return mesh
      }))
      try {
        const sight = (y: number, z: number) => {
          const ray = new Raycaster(new Vector3(out * 4, y, z), new Vector3(out, 0, 0), 0, 8)
          return ray.intersectObjects(meshes).length
        }
        expect(sight(2.7, glazing.z)).toBe(0)
        expect(sight(1.4, glazing.z - 3.8)).toBe(0)
        expect(sight(4, glazing.z + 3.8)).toBe(0)
        expect(sight(0.6, glazing.z)).toBeGreaterThan(0)
        expect(sight(4.8, glazing.z)).toBeGreaterThan(0)
        expect(sight(2.7, glazing.z + 4.5)).toBeGreaterThan(0)
      } finally {
        for (const geometry of geometries) {
          geometry.dispose()
        }
        material.dispose()
      }
    })
    test('stops the aim at its glass from both sides, while the wall around it still takes artworks', () => {
      expect(lobbyWindowGlassDistance(glazing, [out * 4, 2.7, -24], [out, 0, 0])).toBeCloseTo(4 - floorGlassThickness / 2)
      expect(lobbyWindowGlassDistance(glazing, [out * 12, 2.7, -24], [-out, 0, 0])).toBeCloseTo(4 - floorGlassThickness / 2)
      expect(lobbyWindowGlassDistance(glazing, [out * 4, 0.8, -24], [out, 0, 0])).toBeUndefined()
      expect(lobbyWindowGlassDistance(glazing, [out * 4, 2.7, -24], [-out, 0, 0])).toBeUndefined()
      expect(galleryPlacement.findPlacement([out * 4, 2.7, -24], [out, 0, 0], 1, 1, [])).toMatchObject({
        wallId: lobbySide.id,
        valid: false,
        reason: 'window',
      })
      expect(galleryPlacement.findPlacement([out * 12, 2.7, -22], [-out, 0, 0], 1, 1, [])).toMatchObject({
        wallId: roomSide.id,
        valid: false,
        reason: 'window',
      })
      // Beside it and below it the walls stay what they were.
      expect(galleryPlacement.findPlacement([out * 12, 2.7, -17.5], [-out, 0, 0], 1, 1, [])).toMatchObject({
        wallId: roomSide.id,
        valid: true,
      })
      expect(galleryPlacement.findPlacement([out * 4, 2.7, -12], [out, 0, 0], 1, 1, [])).toMatchObject({
        wallId: lobbySide.id,
        valid: true,
      })
      // An artwork reaching over the window’s edge is turned away.
      expect(placementIssue(roomSide, wallPosition(roomSide, wallCoordinates(roomSide, [out * 8, 0, -19.5]), 2.7), 1, 1, [])).not.toBe('')
    })
    test('the shipped collection hangs clear of it', () => {
      for (const p of samplePortraits) {
        const wall = [roomSide, lobbySide].find(candidate => candidate.id === p.wallId)
        if (!wall) {
          continue
        }
        expect(placementIssue(wall, p.position, p.width, p.height, samplePortraits, p.id)).toBe('')
      }
    })
  })
}
test('both glass walls are cast from the floor window’s glass, sharing one material of their own', () => {
  for (const isHeavy of [true, false]) {
    const materials = createArchitecturalGlassMaterials(isHeavy)
    try {
      expect(materials.lobbyWindow.constructor).toBe(materials.lobby.constructor)
      if (isHeavy) {
        expect(materials.lobbyWindow).toBeInstanceOf(CastFloorGlassMaterial)
        expect(materials.lobbyWindow).not.toBe(materials.lobby)
        expect(materials.lobbyWindow.depthWrite).toBe(true)
      }
    } finally {
      disposeArchitecturalGlassMaterials(materials)
    }
  }
  expect(salonWindow.thickness).toBe(floorGlassThickness)
})
