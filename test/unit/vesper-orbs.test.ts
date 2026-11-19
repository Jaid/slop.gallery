import {expect, test} from 'bun:test'

import {columnPedestalRadius} from '../../src/lib/gallery/ColumnPedestalGeometry.ts'
import {floorTile} from '../../src/lib/gallery/floors.ts'
import {vesper, vesperOrbPedestals} from '../../src/lib/gallery/vesper.ts'
import {vesperOrbs} from '../../src/lib/gallery/vesperOrbs.ts'
import {randomOrbs} from '../../src/orbs/index.ts'
import {floorHeight, roomAt} from './fixtures/gallery.ts'

test('the Vesper stands four orbs on column pedestals in two northern rows of two, centered on floor tiles and clear of the walls and each other', () => {
  expect(vesperOrbPedestals).toHaveLength(4)
  expect(vesperOrbPedestals.map(({position: [x, , z]}) => [x - vesper.center[0], z - vesper.center[1]])).toEqual([[-1, -7], [1, -7], [1, -3], [-1, -3]])
  const [centerX, centerZ] = vesper.center
  const middleX = vesperOrbPedestals.reduce((sum, {position: [x]}) => sum + x, 0) / vesperOrbPedestals.length
  const middleZ = vesperOrbPedestals.reduce((sum, {position: [, , z]}) => sum + z, 0) / vesperOrbPedestals.length
  expect(middleX).toBeCloseTo(centerX, 9)
  expect(middleZ).toBeLessThan(centerZ)
  for (const [index, {position, rotation}] of vesperOrbPedestals.entries()) {
    const [x, y, z] = position
    expect(roomAt([x, 1.7, z])).toBe('vesper')
    expect(y).toBe(floorHeight([x, 1.7, z]))
    // In the middle of a floor tile, as far from its seams on every side.
    expect((x - centerX + vesper.size[0] / 2) % floorTile).toBeCloseTo(floorTile / 2, 9)
    expect((z - centerZ + vesper.size[1] / 2) % floorTile).toBeCloseTo(floorTile / 2, 9)
    // Room enough to walk round it, short of the walls.
    expect(vesper.size[0] / 2 - Math.abs(x - centerX) - columnPedestalRadius.foot).toBeGreaterThan(3)
    expect(vesper.size[1] / 2 - Math.abs(z - centerZ) - columnPedestalRadius.foot).toBeGreaterThan(3)
    // The holder’s front foot faces out from the rows’ middle.
    expect(Math.sin(rotation) * (x - middleX) + Math.cos(rotation) * (z - middleZ)).toBeCloseTo(Math.hypot(x - middleX, z - middleZ), 9)
    for (const {position: [otherX, , otherZ]} of vesperOrbPedestals.slice(index + 1)) {
      // Room enough for a visitor of 30 cm half-width to pass between them.
      expect(Math.hypot(otherX - x, otherZ - z) - columnPedestalRadius.foot * 2).toBeGreaterThan(1.2)
    }
  }
})
test('the seed shuffles the four eligible orbs across the pedestals without repeats', () => {
  expect(vesperOrbs(7)).toEqual(vesperOrbs(7))
  const eligible = randomOrbs.map(orb => orb.propId).toSorted()
  const seenAt = vesperOrbPedestals.map(() => new Set<string>)
  for (let seed = 1; seed <= 200; seed++) {
    const exhibits = vesperOrbs(seed)
    expect(exhibits).toHaveLength(vesperOrbPedestals.length)
    expect(exhibits.map(({id}) => id).toSorted()).toEqual(eligible)
    for (const [index, {id, orb}] of exhibits.entries()) {
      expect(id).toBe(orb.propId)
      seenAt[index].add(id)
    }
  }
  for (const atPedestal of seenAt) {
    expect(atPedestal).toEqual(new Set(eligible))
  }
})
test('in the default environment, the pedestals stand the random orbs in their order instead of rolling them', () => {
  expect(vesperOrbs(0).map(({orb}) => orb)).toEqual(randomOrbs.slice(0, vesperOrbPedestals.length))
  expect(vesperOrbs(0).map(({id}) => id)).toEqual(randomOrbs.map(orb => orb.propId))
})
