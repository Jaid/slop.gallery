import type {Vec3} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {Box3} from 'three/webgpu'

import {lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import tunnelDisplays from '../../src/lib/gallery/tunnelDisplays.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

/** how far apart the sampled columns stand along x and z, in meters; they stand in the middles of the cells of this grid, off the planes fences and floors end on */
const columnSpacing = 0.75
/** the steps a column is searched for floors in, closer than any two floors lie */
const floorProbe = 1
/** where a standing body reaches above the floor under it: its feet, its middle and its eyes */
const bodyHeights = [0.05, 0.9, 1.75]
test('the rooms’ fences cover every point a player’s body takes up on every floor', () => {
  const bounds = new Box3
  for (const room of slopGallery.rooms) {
    for (const box of room.air) {
      bounds.union(box)
    }
  }
  let samples = 0
  const uncovered: Array<Vec3> = []
  for (let x = bounds.min.x + columnSpacing / 2; x < bounds.max.x; x += columnSpacing) {
    for (let z = bounds.min.z + columnSpacing / 2; z < bounds.max.z; z += columnSpacing) {
      const floors = new Set<number>
      for (let y = bounds.min.y; y <= bounds.max.y + floorProbe; y += floorProbe) {
        floors.add(slopGallery.floorHeight([x, y, z]))
      }
      for (const floor of floors) {
        for (const height of bodyHeights) {
          const position: Vec3 = [x, floor + height, z]
          if (!slopGallery.contains(position)) {
            continue
          }
          samples++
          if (!slopGallery.roomAt(position)) {
            uncovered.push(position)
          }
        }
      }
    }
  }
  expect(samples).toBeGreaterThan(20_000)
  expect(uncovered.slice(0, 5)).toEqual([])
})
test('the Lodge’s window niche belongs to the Lodge, out to the glass in the Corridor’s lining', () => {
  const sill = lodgeWindow.bottom + 0.2
  for (const x of [lodgeWindow.roomX - 0.2, (lodgeWindow.roomX + lodgeWindow.tunnelX) / 2, lodgeWindow.tunnelX + 0.05]) {
    expect(slopGallery.roomAt([x, sill, lodgeWindow.z])?.id).toBe('lodge')
  }
  expect(slopGallery.roomAt([lodgeWindow.tunnelX - 0.3, sill, lodgeWindow.z])?.id).toBe('corridor')
})
test('the balcony stays the Oculus’ up to its south wall, the staff stairways behind the doors in it are the Exhibition’s', () => {
  for (const {stairway: {door}} of tunnelDisplays) {
    const over = door[1] + 1.6
    for (const x of [door[0] - 0.6, door[0], door[0] + 0.6]) {
      expect(slopGallery.roomAt([x, over, door[2] - 0.2])?.id).toBe('oculus')
      expect(slopGallery.roomAt([x, over, door[2] + 0.4])?.id).toBe('exhibition')
    }
  }
  expect(slopGallery.roomAt([0, tunnelDisplays[0].stairway.door[1] + 1.6, tunnelDisplays[0].stairway.door[2] - 1])?.id).toBe('oculus')
})
