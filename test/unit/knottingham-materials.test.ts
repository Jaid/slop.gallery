import {describe, expect, test} from 'bun:test'

import KnotLayout from 'knot-materials/KnotLayout.ts'

import {knotFloorOrigin, knotFloorTile, knotGalleryBounds, knotGalleryCenter} from '../../src/lib/gallery/knotGallery.ts'
import {checkeredTile, cremaMarfil, neroMarquina} from '../../src/lib/materials/marble/index.ts'
import VelvetWallMaterial, {oxbloodVelvet} from '../../src/lib/materials/VelvetWallMaterial.ts'
import lightness from './helpers/lightness.ts'

const layout = {
  origin: knotFloorOrigin,
  tile: knotFloorTile,
}
describe('Knottingham’s checkered marble floor', () => {
  test('whole tiles run from the north wall to the south wall for any number of rows', () => {
    for (const rowLengths of [[1], [4], [3, 2], [4, 4, 4, 4, 4, 4, 4, 4], Array.from({length: 13}, () => 5)]) {
      const {bounds, rowSpacing} = new KnotLayout(rowLengths)
      const tile = rowSpacing / 8
      const rows = (bounds.southZ - bounds.northZ) / tile
      expect(rows).toBeCloseTo(Math.round(rows), 9)
    }
    expect(knotFloorOrigin[1]).toBe(knotGalleryBounds.northZ)
    const rows = Math.round((knotGalleryBounds.southZ - knotGalleryBounds.northZ) / knotFloorTile)
    const x = knotGalleryCenter[0] + knotFloorTile / 2
    expect(checkeredTile(x, knotGalleryBounds.northZ + 0.01, layout).row).toBe(0)
    expect(checkeredTile(x, knotGalleryBounds.southZ - 0.01, layout).row).toBe(rows - 1)
  })
  test('the grid is centered across the room, so both side walls cut their tiles alike', () => {
    const west = (knotGalleryCenter[0] - knotGalleryBounds.minX) / knotFloorTile % 1
    const east = (knotGalleryBounds.maxX - knotGalleryCenter[0]) / knotFloorTile % 1
    expect(west).toBeCloseTo(east, 9)
    // A seam runs down the middle, and the tiles alternate across it.
    const z = knotGalleryBounds.northZ + knotFloorTile / 2
    const left = checkeredTile(knotGalleryCenter[0] - 0.01, z, layout)
    const right = checkeredTile(knotGalleryCenter[0] + 0.01, z, layout)
    expect(right.column - left.column).toBe(1)
    expect(right.dark).toBe(!left.dark)
  })
  test('the cuts are a cream marble with darker veins and a black Nero Marquina with white veins', () => {
    expect(lightness(cremaMarfil.base)).toBeGreaterThan(200)
    expect(lightness(cremaMarfil.vein)).toBeLessThan(lightness(cremaMarfil.base))
    expect(lightness(neroMarquina.base)).toBeLessThan(30)
    expect(lightness(neroMarquina.vein)).toBeGreaterThan(220)
  })
})
describe('Knottingham’s velvet walls', () => {
  test('builds a sheened, relieved fabric without textures', () => {
    const material = new VelvetWallMaterial
    try {
      expect(material.map).toBeNull()
      expect(material.colorNode).not.toBeNull()
      expect(material.roughnessNode).not.toBeNull()
      expect(material.normalNode).not.toBeNull()
      expect(material.sheenNode).not.toBeNull()
      expect(material.sheenRoughnessNode).not.toBeNull()
      expect(material.metalness).toBe(0)
    } finally {
      material.dispose()
    }
  })
  test('the pile ranges from near-black where it stands to crimson where it is crushed', () => {
    expect(lightness(oxbloodVelvet.deep)).toBeLessThan(lightness(oxbloodVelvet.pile))
    expect(lightness(oxbloodVelvet.pile)).toBeLessThan(lightness(oxbloodVelvet.crushed))
    for (const hex of Object.values(oxbloodVelvet)) {
      const value = Number.parseInt(hex.slice(1), 16)
      // Red dominates every tone.
      expect(value >> 16 & 255).toBeGreaterThan((value >> 8 & 255) * 3)
    }
  })
})
