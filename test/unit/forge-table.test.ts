import {describe, expect, test} from 'bun:test'

import {Box3} from 'three/webgpu'

import {cannonFlight, workbench} from '../../src/lib/gallery/alchemy/alchemyMachine.ts'
import {baseboardCapFront, defaultBaseboardHeight, wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import forge, {forgeTable, forgeTableCenter} from '../../src/lib/gallery/forge.ts'
import {steelTableColliders} from '../../src/lib/gallery/steelTable.ts'
import SteelTableGeometry from '../../src/lib/gallery/SteelTableGeometry.ts'
import {wallCoordinates, wallOffset} from '../../src/lib/placement/wallGeometry.ts'
import forgeSpawns from '../../src/rooms/forge/spawns.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const [tableX, tableZ] = forgeTableCenter
const west = slopGallery.walls.find(wall => wall.id === 'forge-west')!
describe('the Forge’s painter’s table', () => {
  test('stands in the Forge against the middle of its west wall, running along it, its back a hand’s width from the wall’s face', () => {
    expect(slopGallery.roomAt([tableX, 0.5, tableZ])?.id).toBe('forge')
    expect(wallCoordinates(west, [tableX, 0, tableZ])).toBeCloseTo(0, 9)
    expect(wallOffset(west, [tableX, 0, tableZ]) - forgeTable.width / 2).toBeCloseTo(wallFace + 0.05, 9)
    expect(forgeTable.legs).toHaveLength(2)
  })
  test('is a larger steel work table than the wooden one it replaces, in every dimension', () => {
    expect(forgeTable.length).toBe(2.6)
    expect(forgeTable.width).toBe(1.1)
    expect(forgeTable.height).toBe(0.9)
    expect(forgeTable.length).toBeGreaterThan(1.8)
    expect(forgeTable.width).toBeGreaterThan(0.8)
    expect(forgeTable.height).toBeGreaterThan(0.78)
    const geometry = new SteelTableGeometry(forgeTable)
    try {
      for (const part of [geometry.top, geometry.frame]) {
        expect(part.hasAttribute('woodGrain')).toBe(false)
        const bounds = new Box3
        bounds.setFromBufferAttribute(part.getAttribute('position') as never)
        expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6)
        expect(bounds.max.y).toBeLessThanOrEqual(forgeTable.height + 1e-6)
      }
      const top = new Box3
      top.setFromBufferAttribute(geometry.top.getAttribute('position') as never)
      expect(top.max.y).toBeCloseTo(forgeTable.height, 6)
      expect(top.max.x - top.min.x).toBeCloseTo(forgeTable.width, 6)
      expect(top.max.z - top.min.z).toBeCloseTo(forgeTable.length, 6)
    } finally {
      geometry.dispose()
    }
  })
  test('keeps every part that reaches below the baseboard clear of its cap, which stands proud of the wall’s face', () => {
    const capReach = baseboardCapFront - wallFace
    const backEdge = wallOffset(west, [tableX, 0, tableZ]) - forgeTable.width / 2 - wallFace
    for (const {center, size} of steelTableColliders(forgeTable, 'forge-table')) {
      if (center[1] - size[1] / 2 >= defaultBaseboardHeight) {
        continue
      }
      // Its back face, in meters in front of the wall’s face
      expect(backEdge + forgeTable.width / 2 - (Math.abs(center[0]) + size[0] / 2)).toBeGreaterThan(capReach + 0.02)
    }
    // The legs in particular: set in far enough that they never touch the cap
    expect(backEdge + forgeTable.legInset).toBeGreaterThan(capReach + 0.02)
  })
  test('keeps works from hanging on the stretch of the wall behind it', () => {
    const reservation = west.reservations?.find(({u, width}) => Math.abs(u) < 1e-9 && Math.abs(width - forgeTable.length) < 1e-9)
    expect(reservation?.height).toBeCloseTo(forgeTable.height + 0.1, 9)
    expect(reservation?.bottom).toBeUndefined()
  })
  test('stands out of the alchemy machine’s way, the cannon’s shot and where visitors arrive', () => {
    const reach = Math.hypot(forgeTable.width, forgeTable.length) / 2
    for (const [x, , z] of cannonFlight.points) {
      expect(Math.hypot(x - tableX, z - tableZ)).toBeGreaterThan(reach + 3)
    }
    const [benchX, benchZ] = workbench.center
    expect(Math.abs(benchX - tableX) - (workbench.length + forgeTable.width) / 2).toBeGreaterThan(2)
    expect(Math.abs(benchZ - tableZ)).toBeGreaterThan(5)
    const [spawnX, , spawnZ] = forgeSpawns[''].position
    expect(Math.hypot(forge.center[0] + spawnX - tableX, forge.center[1] + spawnZ - tableZ)).toBeGreaterThan(8)
  })
})
