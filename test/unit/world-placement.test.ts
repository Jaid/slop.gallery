import type {Portrait, Vec3} from '../../src/lib/gallery/types.ts'
import type {Wall} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import {knotGalleryBounds, knotGalleryCenter} from '../../src/lib/gallery/knotGallery.ts'
import {HallPlacementSpace} from '../../src/lib/placement/HallPlacementSpace.ts'
import {placementIssues, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import walls, {galleryPlacement} from './fixtures/gallery.ts'

const knotPlacement = knottingham.placement
const knotSpawn = knottingham.spawn
const eye = 1.6
const artwork = (patch: Partial<Portrait>): Portrait => ({
  id: 'guest',
  title: 'A guest',
  creator: 'You',
  description: '',
  source: 'guest',
  position: [0, 2.5, 0],
  rotation: 0,
  width: 1.2,
  height: 1.2,
  hung: false,
  ...patch,
})
/** Aim from `distance` meters in front of a wall straight at the point `u` along it at height `y`. */
const aimAt = (wall: Wall, u: number, y: number, distance = 3) => {
  const target = wallPosition(wall, u, y, 0)
  const origin = wallPosition(wall, u, y, distance)
  return {
    origin,
    direction: target.map((n, i) => n - origin[i]).map(n => n / distance) as Vec3,
  }
}
describe('museum placement', () => {
  test('the gallery world places artworks in the museum’s placement space', () => {
    expect(slopGallery.placement).toBe(galleryPlacement)
    expect(galleryPlacement.walls).toBe(walls)
  })
})
describe('Knottingham placement', () => {
  test('every edge wall takes artworks along its whole free span', () => {
    expect(knotPlacement.walls).toBe(knottingham.walls)
    for (const wall of knottingham.walls) {
      for (const fraction of [-0.3, 0, 0.3]) {
        const u = fraction * wall.width
        const {origin, direction} = aimAt(wall, u, eye + 0.9)
        const placement = knotPlacement.findPlacement(origin, direction, 1.6, 1.2, [])
        expect(placement).toMatchObject({
          wallId: wall.id,
          inReach: true,
          valid: true,
          reason: '',
        })
        expect(wallCoordinates(wall, placement!.position)).toBeCloseTo(u)
        expect(placement!.position[1]).toBeCloseTo(eye + 0.9)
        expect(Math.abs(Math.sin((placement!.rotation - wall.rotation) / 2))).toBeLessThan(1e-9)
      }
    }
  })
  test('the regular frame, label and neighbor rules still apply', () => {
    const wall = knottingham.walls[0]
    const hung = artwork({
      hung: true,
      wallId: wall.id,
      position: wallPosition(wall, 0, 2.5),
      rotation: wall.rotation,
    })
    const {origin, direction} = aimAt(wall, 0.4, 2.5)
    expect(knotPlacement.findPlacement(origin, direction, 1.2, 1.2, [hung])?.reason).toBe(placementIssues.neighbor)
    expect(knotPlacement.findPlacement(origin, direction, 1.2, 1.2, [hung], {ignoreId: hung.id})?.valid).toBe(true)
    const low = aimAt(wall, 0, 0.6)
    expect(knotPlacement.findPlacement(low.origin, low.direction, 1.2, 1.2, [])?.reason).toBe(placementIssues.frame)
    const corner = aimAt(wall, wall.width / 2 - 0.2, 2.5)
    expect(knotPlacement.findPlacement(corner.origin, corner.direction, 1.2, 1.2, [])?.reason).toBe(placementIssues.frame)
  })
  test('the nearest wall wins and distant walls are only previewed', () => {
    const origin: Vec3 = [knotGalleryCenter[0], 2.5, knotGalleryBounds.northZ + 2]
    expect(knotPlacement.findPlacement(origin, [0, 0, -1], 1, 1, [])).toMatchObject({
      wallId: 'arena-north',
      valid: true,
    })
    const far: Vec3 = [knotGalleryCenter[0], 2.5, knotGalleryBounds.northZ + knotPlacement.reach + 1]
    if (far[2] < knotGalleryBounds.southZ) {
      expect(knotPlacement.findPlacement(far, [0, 0, -1], 1, 1, [])).toMatchObject({
        inReach: false,
        valid: false,
        reason: placementIssues.reach,
      })
    }
    expect(knotPlacement.findPlacement(origin, [0, 1, 0], 1, 1, [])).toBeNull()
  })
  test('the hall is level and lost artworks return to the spawn', () => {
    expect(knotPlacement.floorHeight([knotGalleryCenter[0], 3, knotGalleryCenter[2]])).toBe(0)
    expect(knotPlacement.contains(knotPlacement.recoveryPosition)).toBe(true)
    expect(knotPlacement.recoveryPosition[0]).toBe(knotSpawn.position[0])
    expect(knotPlacement.recoveryPosition[2]).toBe(knotSpawn.position[2])
    expect(knotPlacement.contains([knotGalleryBounds.maxX + 0.5, 1, knotGalleryCenter[2]])).toBe(false)
    expect(knotPlacement.contains([Number.NaN, 1, 0])).toBe(false)
  })
})
describe('hall placement', () => {
  test('rejects recovery positions outside the hall', () => {
    expect(() => new HallPlacementSpace(knottingham.walls, knotGalleryBounds, [knotGalleryBounds.maxX + 1, 1, 0])).toThrow(RangeError)
  })
})
