import {describe, expect, test} from 'bun:test'

import {knotFloorOrigin, knotFloorTile, knotGalleryBounds, knotGalleryCenter} from '../../src/lib/gallery/knotGallery.ts'
import {cremaMarfil, neroMarquina} from '../../src/lib/materials/marble/index.ts'
import {oxbloodVelvet} from '../../src/lib/materials/VelvetMaterial.ts'
import VelvetWallMaterial from '../../src/lib/materials/VelvetWallMaterial.ts'
import lightness from './helpers/lightness.ts'

describe('Knottingham’s checkered marble floor', () => {
  test('whole tiles span the room’s depth, with a seam down its center', () => {
    expect(knotFloorOrigin).toEqual([knotGalleryCenter[0], knotGalleryBounds.northZ])
    const rows = (knotGalleryBounds.southZ - knotGalleryBounds.northZ) / knotFloorTile
    expect(rows).toBeCloseTo(Math.round(rows), 9)
    const west = (knotGalleryCenter[0] - knotGalleryBounds.minX) / knotFloorTile % 1
    const east = (knotGalleryBounds.maxX - knotGalleryCenter[0]) / knotFloorTile % 1
    expect(west).toBeCloseTo(east, 9)
  })
  test('the cuts are a cream marble with darker veins and a black Nero Marquina with white veins', () => {
    expect(lightness(cremaMarfil.base)).toBeGreaterThan(lightness(neroMarquina.base))
    expect(lightness(cremaMarfil.vein)).toBeLessThan(lightness(cremaMarfil.base))
    expect(lightness(neroMarquina.vein)).toBeGreaterThan(lightness(neroMarquina.base))
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
