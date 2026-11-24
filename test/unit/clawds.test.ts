import {describe, expect, test} from 'bun:test'

import ArchitectureMaterials from '../../src/components/Architecture/ArchitectureMaterials.ts'
import ClawdsWallpaperMaterial, {flowerSticker, flowerStickerReach} from '../../src/lib/materials/ClawdsWallpaperMaterial.ts'
import MarmorinoMaterial from '../../src/lib/materials/MarmorinoMaterial.ts'
import {upstairsHallWalls} from '../../src/rooms/antechamber/walls.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const {awake, dozing, heart, stroke} = flowerSticker
/** how far a curve reaches from the heart’s middle at most: its control points hold it */
const reach = (curve: ReadonlyArray<readonly [number, number]>) => Math.max(...curve.map(([x, y]) => Math.hypot(x, y)))
describe('Clawds', () => {
  test('builds its stickers on paper', () => {
    const clawds = new ClawdsWallpaperMaterial
    try {
      expect(clawds.colorNode).not.toBeNull()
      expect(clawds.roughnessNode).not.toBeNull()
      expect(clawds.normalNode).not.toBeNull()
      expect(clawds.map).toBeNull()
    } finally {
      clawds.dispose()
    }
  })
  test('rejects stickers that overlap their neighbors, wake farther than they doze or show their faces nearer than they wake', () => {
    const options = [
      {
        size: 0.3,
        spacing: 0.2,
      },
      {size: 0},
      {wake: [0.9, 0.6] as const},
      {
        wake: [0.6, 0.9] as const,
        faces: [0.8, 3] as const,
      },
      {faces: [3, 3] as const},
    ]
    for (const option of options) {
      expect(() => new ClawdsWallpaperMaterial(option)).toThrow(RangeError)
    }
  })
  test('draws both faces inside the heart and every petal inside the sticker’s reach', () => {
    const strokes = [...dozing.eyes.flat(), ...dozing.mouth, ...awake.mouth]
    for (const curve of strokes) {
      expect(reach(curve) + stroke).toBeLessThan(heart)
    }
    // The brows are drawn a little bolder than the other strokes.
    for (const curve of awake.brows) {
      expect(reach(curve) + stroke * 1.3).toBeLessThan(heart)
    }
    for (const [[x, y], [radiusX, radiusY]] of [...awake.eyes, awake.blush]) {
      expect(Math.hypot(Math.abs(x) + radiusX, Math.abs(y) + radiusY)).toBeLessThan(heart)
    }
    for (const [[x, y]] of flowerSticker.petals) {
      expect(Math.hypot(x, y)).toBeLessThan(flowerStickerReach)
    }
  })
})
describe('the upstairs hall’s Clawds', () => {
  test('papers the landing at the head of the Antechamber’s flight up and nothing else of the room', () => {
    const antechamber = slopGallery.room('antechamber')
    const landing = new Set<string>(upstairsHallWalls.map(id => antechamber.room.globalId(id)))
    const walls = slopGallery.walls.filter(wall => wall.room === 'antechamber')
    expect(walls.filter(wall => landing.has(wall.id))).toHaveLength(upstairsHallWalls.length)
    const materials = new ArchitectureMaterials
    try {
      for (const wall of walls) {
        expect(materials.surface(wall)).toBeInstanceOf(landing.has(wall.id) ? ClawdsWallpaperMaterial : MarmorinoMaterial)
      }
    } finally {
      materials.dispose()
    }
  })
})
