import {describe, expect, test} from 'bun:test'

import {knotLightHousingSize} from 'knot-materials/KnotLightPanels.ts'
import {Box3} from 'three/webgpu'

import {banquet, banquetLedSlots, banquetTable} from '../../src/lib/gallery/banquet.ts'
import {plankTableColliders} from '../../src/lib/gallery/plankTable.ts'
import PlankTableGeometry from '../../src/lib/gallery/PlankTableGeometry.ts'
import banquetSpawns from '../../src/rooms/banquet/spawns.ts'

describe('the Banquet’s table', () => {
  test('runs down the middle of the room under all three panes, from end to end of their row', () => {
    const zs = banquetLedSlots.map(({position}) => position[2])
    expect(banquetTable.length).toBeCloseTo(Math.max(...zs) - Math.min(...zs) + knotLightHousingSize[2], 9)
    for (const {position: [x]} of banquetLedSlots) {
      expect(x).toBe(banquet.center[0])
    }
    // Room to walk round it on every side, and a doorway’s width clear of the walls
    expect(banquet.size[0] / 2 - banquetTable.width / 2).toBeGreaterThan(4)
    expect(banquet.size[1] / 2 - banquetTable.length / 2).toBeGreaterThan(4)
    // Well clear of where visitors arrive in the room, which is in its frame like the table
    const [, , spawnZ] = banquetSpawns[''].position
    expect(Math.abs(spawnZ) - banquetTable.length / 2).toBeGreaterThan(1)
  })
  test('stands on five pairs of legs, one at either end and evenly between them', () => {
    const {legs, length, overhang, leg} = banquetTable
    expect(legs).toHaveLength(5)
    expect(legs[2]).toBeCloseTo(0, 9)
    expect(legs[4]).toBeCloseTo(-legs[0], 9)
    expect(legs[4]).toBeCloseTo(length / 2 - overhang - leg / 2 - 0.003, 9)
    expect(legs[3] - legs[2]).toBeCloseTo(legs[4] - legs[3], 9)
  })
  test('stands on its legs, the top over them and the aprons, its colliders around its timber', () => {
    const geometry = new PlankTableGeometry(banquetTable, 2117)
    try {
      const bounds = (new Box3).setFromBufferAttribute(geometry.timber.getAttribute('position') as never)
      expect(bounds.min.y).toBeCloseTo(0, 6)
      expect(bounds.max.y).toBeCloseTo(banquetTable.height, 6)
      expect(bounds.max.x).toBeCloseTo(banquetTable.width / 2 - banquetTable.gap / 2, 6)
      expect(bounds.max.z).toBeCloseTo(banquetTable.length / 2 - 0.0015, 3)
      expect(geometry.timber.hasAttribute('woodGrain')).toBe(true)
    } finally {
      geometry.dispose()
    }
    const [top, ...legs] = plankTableColliders(banquetTable, 'banquet-table')
    expect(top.name).toBe('banquet-table-top')
    expect(top.center[1] + top.size[1] / 2).toBeCloseTo(banquetTable.height, 9)
    expect(legs).toHaveLength(banquetTable.legs.length * 2)
    for (const leg of legs) {
      expect(leg.name).toBe('banquet-table-leg')
      expect(leg.center[1] - leg.size[1] / 2).toBeCloseTo(0, 9)
      expect(leg.center[1] + leg.size[1] / 2).toBeCloseTo(top.center[1] - top.size[1] / 2, 9)
      // Inside the top’s outline, behind the aprons’ faces
      expect(Math.abs(leg.center[0]) + leg.size[0] / 2).toBeLessThan(banquetTable.width / 2 - banquetTable.overhang)
      expect(Math.abs(leg.center[2]) + leg.size[2] / 2).toBeLessThan(banquetTable.length / 2 - banquetTable.overhang)
    }
  })
})
