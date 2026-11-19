import {describe, expect, test} from 'bun:test'

import {lodgeFloorPlanks} from '../../src/lib/gallery/lodge.ts'
import {siennaCeilingPlanks, siennaRugSize, siennaRugThickness} from '../../src/lib/gallery/sienna.ts'
import {siennaWainscot} from '../../src/lib/gallery/siennaWainscot.ts'
import DamaskWallpaperMaterial, {damaskCoverage} from '../../src/lib/materials/DamaskWallpaperMaterial.ts'
import JoineryWoodMaterial from '../../src/lib/materials/JoineryWoodMaterial.ts'
import PersianRugMaterial, {rugBorder} from '../../src/lib/materials/PersianRugMaterial.ts'
import PlankFloorMaterial, {siennaFloorPlanks} from '../../src/lib/materials/PlankFloorMaterial.ts'
import PlankMaterial from '../../src/lib/materials/PlankMaterial.ts'
import walls, {rooms} from './fixtures/gallery.ts'

const sienna = rooms.find(room => room.id === 'sienna')!
const siennaWalls = walls.filter(wall => wall.room === 'sienna')
describe('the Sienna’s wainscot', () => {
  test('whole panels fill each run up to the casing, leaving the narrow piers bare', () => {
    for (const wall of siennaWalls) {
      const panels = siennaWainscot(wall)
      // The vestibule’s 4.8 m east and west walls hold 4 m arches, leaving 40 cm piers too narrow for a 2 m panel; every other wall has room.
      if (wall.id === 'sienna-vestibule_east' || wall.id === 'sienna-vestibule_west') {
        expect(panels).toEqual([])
        continue
      }
      expect(panels.length).toBeGreaterThan(0)
      for (const {u, width} of panels) {
        expect(width).toBeGreaterThan(1.7)
        expect(width).toBeLessThan(2.3)
        expect(Math.abs(u) + width / 2).toBeLessThanOrEqual(wall.width / 2 + 1e-9)
        for (const hole of wall.holes ?? []) {
          expect(Math.abs(u - hole.u)).toBeGreaterThanOrEqual(hole.width / 2 + width / 2 + 0.17 - 1e-9)
        }
      }
      // Neighbors butt against each other, so the paneling reads as one continuous run.
      for (let index = 1; index < panels.length; index++) {
        expect(panels[index].u - panels[index].width / 2).toBeCloseTo(panels[index - 1].u + panels[index - 1].width / 2)
      }
    }
    // No bare strip between the last panel and the arch’s casing.
    for (const id of ['sienna-north', 'sienna-west']) {
      const wall = siennaWalls.find(candidate => candidate.id === id)!
      const hole = wall.holes![0]
      expect(siennaWainscot(wall).some(({u, width}) => Math.abs(Math.abs(u - hole.u) - (width / 2 + hole.width / 2 + 0.17)) < 1e-6)).toBe(true)
    }
    const south = siennaWalls.find(wall => wall.id === 'sienna-south')!
    expect(siennaWainscot(south)).toHaveLength(6)
    for (const id of ['sienna-vestibule_north', 'sienna-vestibule_south']) {
      const wall = siennaWalls.find(candidate => candidate.id === id)!
      expect(siennaWainscot(wall)).toHaveLength(2)
    }
  })
})
describe('the Sienna’s floor', () => {
  test('the varnish is glossier than the matte fast stand-in, but never a mirror', () => {
    const heavy = new PlankFloorMaterial(siennaFloorPlanks, true)
    const fast = new PlankFloorMaterial(siennaFloorPlanks, false)
    try {
      expect(heavy.roughness).toBeLessThan(fast.roughness)
      expect(heavy.roughness).toBeGreaterThan(0.3)
    } finally {
      heavy.dispose()
      fast.dispose()
    }
  })
  test('rejects boards without a size', () => {
    for (const layout of [{
      ...siennaFloorPlanks,
      width: 0,
    }, {
      ...siennaFloorPlanks,
      length: [2, 1] as const,
    }, {
      ...siennaFloorPlanks,
      length: [Number.NaN, 2] as const,
    }]) {
      expect(() => new PlankFloorMaterial(layout, false)).toThrow(RangeError)
    }
  })
  test('the Sienna’s boards are straighter-grained than the Lodge’s rustic ones, and the shared board shader still serves both', () => {
    expect(siennaFloorPlanks.figure!.meander).toBeLessThan(9)
    expect(siennaFloorPlanks.knots).toBeLessThan(lodgeFloorPlanks.knots)
    expect('figure' in lodgeFloorPlanks).toBe(false)
    for (const options of [lodgeFloorPlanks, siennaCeilingPlanks]) {
      const material = new PlankMaterial(options)
      try {
        expect(material.colorNode).not.toBeNull()
        expect(material.normalNode).not.toBeNull()
      } finally {
        material.dispose()
      }
    }
  })
})
describe('the Sienna’s damask', () => {
  test('builds a gilded print on matte silk', () => {
    const damask = new DamaskWallpaperMaterial
    try {
      expect(damask.colorNode).not.toBeNull()
      expect(damask.metalnessNode).not.toBeNull()
      expect(damask.roughnessNode).not.toBeNull()
      expect(damask.normalNode).not.toBeNull()
      expect(damask.map).toBeNull()
    } finally {
      damask.dispose()
    }
    expect(damaskCoverage).toBeGreaterThan(0.1)
    expect(damaskCoverage).toBeLessThan(0.5)
  })
  test('rejects a repeat without a size', () => {
    for (const options of [{repeat: [0, 1] as const}, {repeat: [1, Number.NaN] as const}, {scale: -1}]) {
      expect(() => new DamaskWallpaperMaterial(options)).toThrow(RangeError)
    }
  })
})
describe('the Sienna’s rug', () => {
  test('lies flat inside the room and leaves a field inside its border', () => {
    const [width, depth] = siennaRugSize
    expect(width).toBeLessThan(sienna.size[0])
    expect(depth).toBeLessThan(sienna.size[1])
    expect(siennaRugThickness).toBeGreaterThan(0)
    expect(siennaRugThickness).toBeLessThanOrEqual(0.02)
    expect(Math.min(width, depth)).toBeGreaterThan(rugBorder * 3)
    const rug = new PersianRugMaterial(siennaRugSize)
    try {
      expect(rug.colorNode).not.toBeNull()
      expect(rug.sheenNode).not.toBeNull()
      expect(rug.normalNode).not.toBeNull()
    } finally {
      rug.dispose()
    }
  })
  test('rejects rugs too small for their border', () => {
    expect(() => new PersianRugMaterial([1, 4])).toThrow(RangeError)
    expect(() => new PersianRugMaterial([Number.NaN, 4])).toThrow(RangeError)
  })
})
test('joinery wood builds for every grain axis', () => {
  for (const grain of ['x', 'y', 'z'] as const) {
    const wood = new JoineryWoodMaterial({grain})
    try {
      expect(wood.colorNode).not.toBeNull()
      expect(wood.roughnessNode).not.toBeNull()
      expect(wood.normalNode).not.toBeNull()
      expect(wood.metalness).toBe(0)
    } finally {
      wood.dispose()
    }
  }
})
