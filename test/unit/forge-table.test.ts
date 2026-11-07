import {describe, expect, test} from 'bun:test'

import {cannonFlight, workbench} from '../../src/lib/gallery/alchemy/alchemyMachine.ts'
import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import forge, {forgeTable, forgeTableCenter} from '../../src/lib/gallery/forge.ts'
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
