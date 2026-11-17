import {expect, spyOn, test} from 'bun:test'

import GalleryMaterials from '../../src/worlds/gallery/GalleryMaterials.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

// Deliberately inspect the owning cache, not shader output: these tests guard against constructing resources for an unrelated room as a fallback.
const resources = (materials: GalleryMaterials) => Reflect.get(materials, 'resources') as Map<string, {dispose: () => void}>
const wall = (room: string) => slopGallery.walls.find(value => value.room === room)!
test('gallery materials are lazy and wall fallbacks do not create the Banquet or any other room’s surfaces', () => {
  const materials = new GalleryMaterials(true, 8)
  expect(resources(materials).size).toBe(0)
  for (const room of ['antechamber', 'vesper', 'moonfall', 'salon']) {
    expect(materials.wallMaterial(wall(room))).toBeUndefined()
  }
  for (const room of ['oculus', 'exhibition', 'bastion', 'corridor', 'moonfall']) {
    expect(materials.surfaceMaterial(wall(room))).toBeUndefined()
  }
  expect(resources(materials).size).toBe(0)
  const concrete = materials.wallMaterial(wall('oculus'))!
  expect(materials.wallMaterial(wall('exhibition'))).toBe(concrete)
  expect(resources(materials).keys().toArray()).toEqual(['oculus'])
  const disposed = spyOn(concrete, 'dispose')
  materials.dispose()
  expect(disposed).toHaveBeenCalledTimes(1)
  expect(resources(materials).size).toBe(0)
  disposed.mockRestore()
})
test('a room creates and reuses only its own specialized wall surfaces', () => {
  const materials = new GalleryMaterials(false, 1)
  try {
    const banquet = wall('banquet')
    const surface = materials.surfaceMaterial(banquet)
    expect(surface).toBeDefined()
    expect(materials.surfaceMaterial(banquet)).toBe(surface)
    expect(materials.wallMaterial(banquet)).toBeDefined()
    expect(resources(materials).keys().toArray()).toEqual(['banquet'])
  } finally {
    materials.dispose()
  }
})
