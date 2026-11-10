import {describe, expect, test} from 'bun:test'

import {banquetBoiserie, banquetFloorOrigin, banquetFloorTile, banquetWallPanels, freeWallRuns} from '../../src/lib/gallery/banquet.ts'
import {portraitLabelLayout} from '../../src/lib/gallery/portraitLabel.ts'
import BanquetMaterials from '../../src/lib/materials/BanquetMaterials.ts'
import {BoiserieTrimMaterial, BoiserieWallMaterial} from '../../src/lib/materials/boiserie/index.ts'
import {calacatta, CheckeredMarbleFloorMaterial, checkeredTile, portoro} from '../../src/lib/materials/marble/index.ts'
import walls, {rooms} from './fixtures/gallery.ts'
import samplePortraits from './fixtures/portraits.ts'
import lightness from './helpers/lightness.ts'

const banquet = rooms.find(room => room.id === 'banquet')!
const banquetWalls = walls.filter(wall => wall.room === 'banquet')
const layout = {
  origin: banquetFloorOrigin,
  tile: banquetFloorTile,
}
const corniceBand = (height: number) => height - 0.47
describe('The Banquet’s checkered marble floor', () => {
  test('whole tiles fill the room from its north-west corner and alternate in a checkerboard', () => {
    expect(banquetFloorOrigin).toEqual([banquet.center[0] - banquet.size[0] / 2, banquet.center[1] - banquet.size[1] / 2])
    expect(banquet.size[0] / banquetFloorTile % 1).toBe(0)
    expect(banquet.size[1] / banquetFloorTile % 1).toBe(0)
    const columns = banquet.size[0] / banquetFloorTile
    const rows = banquet.size[1] / banquetFloorTile
    let dark = 0
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const x = banquetFloorOrigin[0] + (column + 0.5) * banquetFloorTile
        const z = banquetFloorOrigin[1] + (row + 0.5) * banquetFloorTile
        const tile = checkeredTile(x, z, layout)
        expect([tile.column, tile.row]).toEqual([column, row])
        const east = checkeredTile(x + banquetFloorTile, z, layout)
        const south = checkeredTile(x, z + banquetFloorTile, layout)
        expect(east.dark).toBe(!tile.dark)
        expect(south.dark).toBe(!tile.dark)
        dark += Number(tile.dark)
      }
    }
    expect(checkeredTile(banquetFloorOrigin[0] + 0.01, banquetFloorOrigin[1] + 0.01, layout).dark).toBe(false)
    expect(dark).toBe(columns * rows / 2)
    // The pattern keeps alternating past the grid origin, where floor division turns negative.
    expect(checkeredTile(banquetFloorOrigin[0] - 0.5, banquetFloorOrigin[1] + 0.5, layout).dark).toBe(true)
  })
  test('rejects tiles without a size', () => {
    for (const tile of [0, -1, Number.NaN]) {
      expect(() => new CheckeredMarbleFloorMaterial({
        origin: banquetFloorOrigin,
        tile,
      })).toThrow(RangeError)
    }
  })
  test('the cuts are a light Calacatta and a dark Portoro with golden veins', () => {
    expect(lightness(calacatta.base)).toBeGreaterThan(200)
    expect(lightness(portoro.base)).toBeLessThan(40)
    const [r, g, b] = [1, 3, 5].map(index => Number.parseInt(portoro.vein.slice(index, index + 2), 16))
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  })
})
describe('The Banquet’s boiserie layout', () => {
  test('every wall gets panels that stay inside the wall, clear of corners, doorways and each other', () => {
    for (const wall of banquetWalls) {
      const {rails, upper} = banquetWallPanels(wall)
      expect(upper.length).toBeGreaterThan(0)
      const sorted = upper.toSorted((a, b) => a.u[0] - b.u[0])
      for (const [index, panel] of sorted.entries()) {
        expect(panel.u[1] - panel.u[0]).toBeGreaterThan(0.6)
        expect(panel.u[1] - panel.u[0]).toBeLessThanOrEqual(banquetBoiserie.maximumLength + 1e-9)
        expect(panel.u[0]).toBeGreaterThanOrEqual(-wall.width / 2 + banquetBoiserie.corner + banquetBoiserie.cornerMargin - 1e-9)
        expect(panel.u[1]).toBeLessThanOrEqual(wall.width / 2 - banquetBoiserie.corner - banquetBoiserie.cornerMargin + 1e-9)
        expect(panel.v[0]).toBeGreaterThan(banquetBoiserie.rail[1])
        // The gilt molding stays clear of the cornice’s gilt band.
        expect(panel.v[1] + banquetBoiserie.moldingHalfWidth).toBeLessThan(corniceBand(wall.height) - 0.1)
        for (const hole of wall.holes ?? []) {
          const outer = hole.width / 2 + 0.17 + banquetBoiserie.openingMargin
          expect(panel.u[1] <= hole.u - outer + 1e-9 || panel.u[0] >= hole.u + outer - 1e-9).toBe(true)
        }
        const left = index > 0 ? sorted[index - 1].u[1] : undefined
        // Neighbors in one run keep the regular gap; only a doorway parts them further.
        if (left === undefined || (wall.holes ?? []).some(hole => hole.u > left && hole.u < panel.u[0])) {
          continue
        }
        expect(panel.u[0] - left).toBeCloseTo(banquetBoiserie.gap, 9)
      }
      for (const rail of rails) {
        expect(rail.v).toEqual(banquetBoiserie.rail)
        for (const hole of wall.holes ?? []) {
          // The rail stops at the doorway surround instead of running across the opening.
          expect(rail.u[1] <= hole.u - hole.width / 2 - 0.17 + 1e-9 || rail.u[0] >= hole.u + hole.width / 2 + 0.17 - 1e-9).toBe(true)
        }
      }
      // Without doorways, one rail runs from corner to corner.
      if (!wall.holes?.length) {
        expect(rails).toEqual([{
          u: [-wall.width / 2 + banquetBoiserie.corner, wall.width / 2 - banquetBoiserie.corner],
          v: banquetBoiserie.rail,
        }])
      }
    }
  })
  test('a doorway splits the panels into runs on both sides, and a sliver beside it is left plain', () => {
    const plain = freeWallRuns({width: 12})
    expect(plain).toHaveLength(1)
    const doorway = freeWallRuns({
      width: 12,
      holes: [{
        u: 0,
        width: 2.8,
        height: 3.8,
        profile: 'arch',
      }],
    })
    expect(doorway).toHaveLength(2)
    const sliver = freeWallRuns({
      width: 6,
      holes: [{
        u: 2.4,
        width: 2.8,
        height: 3.8,
        profile: 'arch',
      }],
    })
    expect(sliver.every(([left, right]) => right - left >= 0.6)).toBe(true)
    expect(sliver.some(([, right]) => right > 1)).toBe(false)
  })
  test('the placards of the shipped artworks clear the chair rail', () => {
    const hung = samplePortraits.filter(portrait => portrait.wallId?.startsWith('banquet-'))
    expect(hung.length).toBeGreaterThan(0)
    for (const portrait of hung) {
      const bottom = portrait.position[1] + portraitLabelLayout(portrait.width, portrait.height).bottom
      expect(bottom).toBeGreaterThanOrEqual(banquetBoiserie.rail[1])
    }
  })
})
describe('The Banquet’s boiserie materials', () => {
  test('every Banquet wall gets its own surface and trim, and other rooms get none', () => {
    const materials = new BanquetMaterials
    try {
      expect(materials.walls.size).toBe(banquetWalls.length)
      for (const wall of banquetWalls) {
        const surface = materials.surface(wall)!
        const trim = materials.trim(wall)!
        expect(surface).toBeInstanceOf(BoiserieWallMaterial)
        expect(trim).toBeInstanceOf(BoiserieTrimMaterial)
        for (const material of [surface, trim]) {
          expect(material.colorNode).not.toBeNull()
          expect(material.roughnessNode).not.toBeNull()
          expect(material.metalnessNode).not.toBeNull()
        }
        expect(surface.normalNode).not.toBeNull()
      }
      const surfaces = new Set(banquetWalls.map(wall => materials.surface(wall)))
      expect(surfaces.size).toBe(banquetWalls.length)
      const lobby = walls.find(wall => wall.room === 'lobby')!
      expect(materials.surface(lobby)).toBeUndefined()
      expect(materials.trim(lobby)).toBeUndefined()
    } finally {
      materials.dispose()
    }
  })
  test('disposing releases every material', () => {
    const materials = new BanquetMaterials
    let disposed = 0
    for (const {surface, trim} of materials.walls.values()) {
      surface.addEventListener('dispose', () => disposed++)
      trim.addEventListener('dispose', () => disposed++)
    }
    materials.dispose()
    expect(disposed).toBe(banquetWalls.length * 2)
  })
  test('rejects invalid layouts', () => {
    expect(() => new BoiserieWallMaterial({panels: [{
      u: [1, 0],
      v: [1, 2],
    }]})).toThrow(RangeError)
    expect(() => new BoiserieWallMaterial({
      panels: [],
      rails: [{
        u: [0, 1],
        v: [1, 1],
      }],
    })).toThrow(RangeError)
    expect(() => new BoiserieWallMaterial({
      panels: [],
      moldingHalfWidth: 0,
    })).toThrow(RangeError)
    expect(() => new BoiserieTrimMaterial({wallHeight: 0.5})).toThrow(RangeError)
    expect(() => new BoiserieTrimMaterial({
      wallHeight: 5.5,
      baseboardHeight: 0.03,
    })).toThrow(RangeError)
  })
})
