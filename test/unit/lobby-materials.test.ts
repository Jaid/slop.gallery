import {describe, expect, test} from 'bun:test'

import {floorTile, roomFloorPlan} from '../../src/lib/gallery/floors.ts'
import PolishedBrassMaterial from '../../src/lib/materials/PolishedBrassMaterial.ts'
import {lobbyFloorTravertine, lobbyWallTravertine, TravertineFloorMaterial, travertinePalette, travertineTile, TravertineWallMaterial} from '../../src/lib/materials/travertine/index.ts'
import {rooms} from './fixtures/gallery.ts'
import lightness from './helpers/lightness.ts'

const lobby = rooms.find(room => room.id === 'lobby')!
const origin = [lobby.center[0] - lobby.size[0] / 2, lobby.center[1] - lobby.size[1] / 2] as const
const layout = {
  origin,
  tile: floorTile,
}
describe('the Lobby’s travertine floor', () => {
  test('every tile of the shader grid is bounded by the seams laid over the floor', () => {
    const plan = roomFloorPlan(lobby)
    // Seams are laid in room-local coordinates; the floor material works in world coordinates. Seams beside the floor opening are trimmed to its edge, so each only has to cover a grid line.
    const onGrid = (center: number, width: number, start: number) => {
      const line = Math.round((center - start) / floorTile) * floorTile + start
      return Math.abs(center - line) <= width / 2 + 1e-9
    }
    const columns = plan.seams.filter(seam => seam.size[0] < 0.1)
    const rows = plan.seams.filter(seam => seam.size[1] < 0.1)
    for (const seam of columns) {
      expect(onGrid(seam.center[0] + lobby.center[0], seam.size[0], origin[0])).toBe(true)
    }
    for (const seam of rows) {
      expect(onGrid(seam.center[1] + lobby.center[1], seam.size[1], origin[1])).toBe(true)
    }
    const seamXs = new Set(columns.map(seam => Math.round(seam.center[0] + lobby.center[0])))
    // The room is a whole number of tiles, so no sliver tiles at the walls.
    expect(lobby.size[0] / floorTile % 1).toBe(0)
    expect(lobby.size[1] / floorTile % 1).toBe(0)
    expect(seamXs.size).toBe(lobby.size[0] / floorTile + 1)
  })
  test('a point maps to the tile whose bounds contain it, and neighbors are distinct tiles', () => {
    for (let column = 0; column < lobby.size[0] / floorTile; column++) {
      for (let row = 0; row < lobby.size[1] / floorTile; row++) {
        const x = origin[0] + (column + 0.3) * floorTile
        const z = origin[1] + (row + 0.7) * floorTile
        const tile = travertineTile(x, z, layout)
        expect([tile.column, tile.row]).toEqual([column, row])
        expect(Math.abs(tile.center[0] - x)).toBeLessThan(floorTile / 2)
        expect(Math.abs(tile.center[1] - z)).toBeLessThan(floorTile / 2)
      }
    }
    const a = travertineTile(origin[0] + floorTile - 1e-6, origin[1] + 0.5, layout)
    const b = travertineTile(origin[0] + floorTile + 1e-6, origin[1] + 0.5, layout)
    expect(b.column).toBe(a.column + 1)
  })
  test('rejects tiles without a size', () => {
    for (const tile of [0, -1, Number.NaN]) {
      expect(() => new TravertineFloorMaterial({
        origin,
        tile,
      })).toThrow(RangeError)
    }
  })
})
describe('the Lobby’s travertine walls', () => {
  test('wall and trim materials build every surface node', () => {
    const clad = new TravertineWallMaterial({
      cladding: {
        course: 1.1,
        length: 2.2,
      },
    })
    const trim = new TravertineWallMaterial
    try {
      for (const material of [clad, trim]) {
        expect(material.colorNode).not.toBeNull()
        expect(material.roughnessNode).not.toBeNull()
        expect(material.normalNode).not.toBeNull()
        expect(material.metalness).toBe(0)
      }
    } finally {
      clad.dispose()
      trim.dispose()
    }
  })
  test('rejects cladding without a size', () => {
    for (const cladding of [{
      course: 0,
      length: 1,
    }, {
      course: 1,
      length: -2,
    }, {
      course: Number.NaN,
      length: 1,
    }]) {
      expect(() => new TravertineWallMaterial({cladding})).toThrow(RangeError)
    }
  })
  test('the walls are a lighter, calmer cut than the floor', () => {
    expect(lobbyFloorTravertine.palette).toBe(travertinePalette)
    for (const key of ['base', 'light', 'vein'] as const) {
      expect(lightness(lobbyWallTravertine.palette[key])).toBeGreaterThan(lightness(lobbyFloorTravertine.palette[key]))
    }
    expect(lobbyWallTravertine.banding).toBeLessThan(lobbyFloorTravertine.banding)
    expect(lobbyWallTravertine.pores).toBeLessThan(lobbyFloorTravertine.pores)
    expect(lobbyWallTravertine.poreDepth).toBeLessThan(lobbyFloorTravertine.poreDepth)
  })
})
test('the brass inlay is metallic, polished and procedurally varied', () => {
  const brass = new PolishedBrassMaterial
  try {
    expect(brass.metalness).toBeGreaterThan(0.5)
    expect(brass.roughness).toBeLessThan(0.4)
    expect(brass.colorNode).not.toBeNull()
    expect(brass.roughnessNode).not.toBeNull()
  } finally {
    brass.dispose()
  }
})
