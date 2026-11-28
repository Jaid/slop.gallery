import {expect, test} from 'bun:test'

import {columnPedestalRadius} from '../../src/lib/gallery/ColumnPedestalGeometry.ts'
import {vesper, vesperOrbCircle, vesperOrbPedestals} from '../../src/lib/gallery/vesper.ts'
import {vesperOrbs} from '../../src/lib/gallery/vesperOrbs.ts'
import {horrorOrb, promptOrbs, randomOrbs} from '../../src/orbs/index.ts'
import {floorHeight, roomAt} from './fixtures/gallery.ts'

test('the Vesper stands five orbs on column pedestals evenly round a circle in its north half, clockwise from the north, clear of the walls and each other', () => {
  expect(vesperOrbPedestals).toHaveLength(5)
  const [centerX, centerZ] = vesper.center
  const {center: [middleX, middleZ], radius} = vesperOrbCircle
  expect(middleX).toBe(centerX)
  // Even the southernmost pedestal stays in the room’s north half.
  expect(Math.max(...vesperOrbPedestals.map(({position}) => position[2]))).toBeLessThan(centerZ)
  for (const [index, {position, rotation}] of vesperOrbPedestals.entries()) {
    const [x, y, z] = position
    expect(roomAt([x, 1.7, z])).toBe('vesper')
    expect(y).toBe(floorHeight([x, 1.7, z]))
    expect(Math.hypot(x - middleX, z - middleZ)).toBeCloseTo(radius, 9)
    // a fifth of a turn clockwise past the last one, seen from above with north at the top
    const turn = (Math.atan2(x - middleX, middleZ - z) + Math.PI * 2) % (Math.PI * 2)
    expect(turn).toBeCloseTo(index / vesperOrbPedestals.length * Math.PI * 2, 9)
    // clearance for walking around the pedestal
    expect(vesper.size[0] / 2 - Math.abs(x - centerX) - columnPedestalRadius.foot).toBeGreaterThan(2.5)
    expect(vesper.size[1] / 2 - Math.abs(z - centerZ) - columnPedestalRadius.foot).toBeGreaterThan(3)
    // The holder’s front foot faces out from the circle’s middle.
    expect(Math.sin(rotation) * (x - middleX) + Math.cos(rotation) * (z - middleZ)).toBeCloseTo(radius, 9)
    for (const {position: [otherX, , otherZ]} of vesperOrbPedestals.slice(index + 1)) {
      // Allow a visitor 60 cm wide to pass without brushing either column.
      expect(Math.hypot(otherX - x, otherZ - z) - columnPedestalRadius.foot * 2).toBeGreaterThan(1.2)
    }
  }
})
test('each pedestal exhibits one distinct orb, in catalog order by default and shuffled by seed otherwise', () => {
  expect(vesperOrbs(0)).toEqual(randomOrbs)
  expect(vesperOrbs(7)).toEqual(vesperOrbs(7))
  const eligible = new Set(promptOrbs.filter(orb => orb !== horrorOrb).map(orb => orb.propId))
  expect(eligible.size).toBe(vesperOrbPedestals.length)
  const seenAt = vesperOrbPedestals.map(() => new Set<string>)
  for (let seed = 1; seed <= 200; seed++) {
    const exhibits = vesperOrbs(seed)
    expect(exhibits).toHaveLength(vesperOrbPedestals.length)
    expect(new Set(exhibits.map(orb => orb.propId))).toEqual(eligible)
    for (const [index, orb] of exhibits.entries()) {
      seenAt[index].add(orb.propId)
    }
  }
  for (const atPedestal of seenAt) {
    expect(atPedestal).toEqual(eligible)
  }
})
