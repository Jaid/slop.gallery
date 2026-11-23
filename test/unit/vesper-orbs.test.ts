import {expect, test} from 'bun:test'

import {columnPedestalRadius} from '../../src/lib/gallery/ColumnPedestalGeometry.ts'
import {floorTile} from '../../src/lib/gallery/floors.ts'
import {vesper, vesperOrbPedestals} from '../../src/lib/gallery/vesper.ts'
import {vesperOrbs} from '../../src/lib/gallery/vesperOrbs.ts'
import {randomOrbs} from '../../src/orbs/index.ts'
import {floorHeight, roomAt} from './fixtures/gallery.ts'

test('the Vesper stands four orbs on column pedestals in two northern rows of two, centered on floor tiles and clear of the walls and each other', () => {
  const rows = Map.groupBy(vesperOrbPedestals, ({position}) => position[2])
  expect(rows.size).toBe(2)
  const [front, back] = rows.values().map(row => row.map(({position}) => position[0]).toSorted((a, b) => a - b)).toArray()
  expect(front).toHaveLength(2)
  expect(back).toEqual(front)
  const [centerX, centerZ] = vesper.center
  const middleX = vesperOrbPedestals.reduce((sum, {position: [x]}) => sum + x, 0) / vesperOrbPedestals.length
  const middleZ = vesperOrbPedestals.reduce((sum, {position: [, , z]}) => sum + z, 0) / vesperOrbPedestals.length
  expect(middleX).toBeCloseTo(centerX, 9)
  expect(Math.max(...rows.keys())).toBeLessThan(centerZ)
  for (const [index, {position, rotation}] of vesperOrbPedestals.entries()) {
    const [x, y, z] = position
    expect(roomAt([x, 1.7, z])).toBe('vesper')
    expect(y).toBe(floorHeight([x, 1.7, z]))
    expect((x - centerX + vesper.size[0] / 2) % floorTile).toBeCloseTo(floorTile / 2, 9)
    expect((z - centerZ + vesper.size[1] / 2) % floorTile).toBeCloseTo(floorTile / 2, 9)
    // clearance for walking around the pedestal
    expect(vesper.size[0] / 2 - Math.abs(x - centerX) - columnPedestalRadius.foot).toBeGreaterThan(3)
    expect(vesper.size[1] / 2 - Math.abs(z - centerZ) - columnPedestalRadius.foot).toBeGreaterThan(3)
    // The holder’s front foot faces out from the rows’ middle.
    expect(Math.sin(rotation) * (x - middleX) + Math.cos(rotation) * (z - middleZ)).toBeCloseTo(Math.hypot(x - middleX, z - middleZ), 9)
    for (const {position: [otherX, , otherZ]} of vesperOrbPedestals.slice(index + 1)) {
      // Allow a visitor 60 cm wide to pass without brushing either column.
      expect(Math.hypot(otherX - x, otherZ - z) - columnPedestalRadius.foot * 2).toBeGreaterThan(1.2)
    }
  }
})
test('each pass over the orb pool shuffles without replacement and each pedestal has a distinct prop id', () => {
  expect(vesperOrbs(7)).toEqual(vesperOrbs(7))
  const eligible = new Set(randomOrbs.map(orb => orb.propId))
  const seenAt = vesperOrbPedestals.map(() => new Set<string>)
  for (let seed = 1; seed <= 200; seed++) {
    const exhibits = vesperOrbs(seed)
    expect(exhibits).toHaveLength(vesperOrbPedestals.length)
    const ids = new Set(exhibits.map(({id}) => id))
    expect(ids.size).toBe(exhibits.length)
    for (let start = 0; start < exhibits.length; start += eligible.size) {
      const pass = exhibits.slice(start, start + eligible.size)
      const drawn = new Set(pass.map(({orb}) => orb))
      expect(drawn.size).toBe(pass.length)
    }
    for (const [index, {id, orb}] of exhibits.entries()) {
      if (index < eligible.size) {
        expect(id).toBe(orb.propId)
      }
      seenAt[index].add(orb.propId)
    }
  }
  for (const atPedestal of seenAt) {
    expect(atPedestal).toEqual(eligible)
  }
})
test('in the default environment, the pedestals stand the random orbs in their order instead of rolling them', () => {
  expect(vesperOrbs(0).map(({orb}) => orb)).toEqual(vesperOrbPedestals.map((_, index) => randomOrbs[index % randomOrbs.length]))
})
