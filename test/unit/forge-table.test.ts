import type {IronTable} from '../../src/lib/gallery/ironTable.ts'
import type {Wall} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import {Matrix4, Vector3} from 'three/webgpu'

import {cannonFlight, machineBody, workbench} from '../../src/lib/gallery/alchemy/alchemyMachine.ts'
import WorkbenchGeometry from '../../src/lib/gallery/alchemy/WorkbenchGeometry.ts'
import {baseboardCapFront, defaultBaseboardHeight, wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import forge, {forgeGauge, forgeRowTables, forgeSideTable, forgeSideTableCenter, forgeSideTableTurn, forgeTable, forgeTableCenter, forgeTableTurn} from '../../src/lib/gallery/forge.ts'
import {ironTableColliders} from '../../src/lib/gallery/ironTable.ts'
import IronTableGeometry from '../../src/lib/gallery/IronTableGeometry.ts'
import {wallOffset} from '../../src/lib/placement/wallGeometry.ts'
import forgeSpawns from '../../src/rooms/forge/spawns.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const [benchX, benchZ] = workbench.center
const west = slopGallery.walls.find(wall => wall.id === 'forge-west')!
const south = slopGallery.walls.find(wall => wall.id === 'forge-south')!
const east = slopGallery.walls.find(wall => wall.id === 'forge-east')!
/** how far out from the room’s axis the floor’s brass gauge reaches, from the inner edge of its strip to the ends of its longest ticks */
const gauge = [forgeGauge.offset - forgeGauge.strip / 2, forgeGauge.offset + Math.max(...forgeGauge.ticks.map(([, reach]) => reach))] as const
/** A table’s clearances in the world: its feet from the gauge, its lower frame from the baseboard and its closest point to the wall. */
function wallReach({frame, top}: IronTableGeometry, wall: Wall, [x, z]: readonly [number, number], turn: number) {
  const placement = new Matrix4
  placement.makeRotationY(turn).setPosition(x, 0, z)
  const point = new Vector3
  let nearestLow = Infinity
  let footToGauge = Infinity
  let nearest = Infinity
  for (const geometry of [frame, top]) {
    const position = geometry.getAttribute('position')
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(placement)
      const offset = wallOffset(wall, [point.x, point.y, point.z])
      nearest = Math.min(nearest, offset)
      if (point.y < 0.01 && Math.abs(point.z - forge.center[1]) < forge.size[1] / 2 - forgeGauge.inset) {
        const out = Math.abs(point.x - forge.center[0])
        footToGauge = Math.min(footToGauge, Math.max(gauge[0] - out, out - gauge[1]))
      }
      if (point.y >= defaultBaseboardHeight + 0.01) {
        continue
      }
      nearestLow = Math.min(nearestLow, offset)
    }
  }
  return {
    footToGauge,
    nearest,
    nearestLow,
  }
}
const tables = [
  {
    name: 'the painter’s table',
    table: forgeTable,
    wall: west,
    center: forgeTableCenter,
    turn: forgeTableTurn,
    geometry: () => new IronTableGeometry(forgeTable),
  },
  {
    name: 'the side table',
    table: forgeSideTable,
    wall: east,
    center: forgeSideTableCenter,
    turn: forgeSideTableTurn,
    geometry: () => new IronTableGeometry(forgeSideTable),
  },
  {
    name: 'the alchemy machine’s workbench',
    table: workbench as IronTable,
    wall: south,
    center: workbench.center,
    turn: 0,
    geometry: () => new WorkbenchGeometry,
  },
] as const
describe('the Forge’s tables', () => {
  for (const {center, geometry: build, name, table, turn, wall} of tables) {
    test(`${name} supports its slab at the planned height on a frame clear of the baseboard`, () => {
      const geometry = build()
      try {
        const {footToGauge, nearest, nearestLow} = wallReach(geometry, wall, center, turn)
        expect(nearestLow - baseboardCapFront).toBeGreaterThan(0.005)
        expect(nearest).toBeGreaterThan(wallFace + 0.02)
        expect(footToGauge).toBeGreaterThan(0.013)
        expect(geometry.top.hasAttribute('woodGrain')).toBe(false)
        expect(geometry.frame.hasAttribute('woodGrain')).toBe(false)
        // Its slab rests on the band under it, as high as the table is.
        geometry.top.computeBoundingBox()
        expect(geometry.top.boundingBox!.max.y).toBeCloseTo(table.height, 6)
        expect(geometry.top.boundingBox!.max.x - geometry.top.boundingBox!.min.x).toBeCloseTo(table.length, 6)
        expect(geometry.top.boundingBox!.max.z - geometry.top.boundingBox!.min.z).toBeCloseTo(table.depth, 6)
        expect(geometry.top.boundingBox!.min.y).toBeCloseTo(table.height - table.top, 6)
      } finally {
        geometry.dispose()
      }
    })
  }
  test('the workbench’s frame stands clear of the alchemy machine’s body between its legs', () => {
    const [width, height, depth] = machineBody.size
    const [x, z] = machineBody.center
    // the body with its bands and rivets round it
    const body = {
      min: [x - width / 2 - 0.026, 0, z - depth / 2 - 0.026],
      max: [x + width / 2 + 0.026, height, z + depth / 2 + 0.026],
    }
    for (const {center, size} of ironTableColliders(workbench, 'alchemy-workbench', {top: false})) {
      const world = [benchX + center[0], center[1], benchZ + center[2]]
      const gaps = world.map((value, axis) => Math.max(body.min[axis] - (value + size[axis] / 2), value - size[axis] / 2 - body.max[axis]))
      expect(Math.max(...gaps)).toBeGreaterThan(0.004)
    }
  })
})
describe('the Forge’s two rows of tables', () => {
  test('leave a continuous aisle from the vestibule to the alchemy workbench, and room to walk around the outside', () => {
    const [spawnX, , spawnZ] = forgeSpawns[''].position
    for (const {center: [x, z], turn} of forgeRowTables) {
      const cos = Math.cos(turn)
      const sin = Math.sin(turn)
      const halfWidth = (Math.abs(cos) * forgeTable.length + Math.abs(sin) * forgeTable.depth) / 2
      const halfLength = (Math.abs(sin) * forgeTable.length + Math.abs(cos) * forgeTable.depth) / 2
      expect(forge.size[0] / 2 - baseboardCapFront - Math.abs(x - forge.center[0]) - halfWidth).toBeGreaterThan(1)
      expect(z - halfLength - (forge.center[1] - forge.size[1] / 2)).toBeGreaterThan(1)
      expect(benchZ - workbench.depth / 2 - (z + halfLength)).toBeGreaterThan(0.7)
      // Measure from the spawn to the rotated slab, rather than its enclosing box.
      const sx = forge.center[0] + spawnX - x
      const sz = forge.center[1] + spawnZ - z
      const dx = Math.max(0, Math.abs(cos * sx - sin * sz) - forgeTable.length / 2)
      const dz = Math.max(0, Math.abs(sin * sx + cos * sz) - forgeTable.depth / 2)
      expect(Math.hypot(dx, dz)).toBeGreaterThan(1)
      for (const [orbX] of cannonFlight.points) {
        expect(Math.abs(orbX - x) - halfWidth).toBeGreaterThan(1.8)
      }
    }
  })
  test('its colliders hold up whatever lies on its slab and stand where its legs do', () => {
    const [slab, ...rest] = ironTableColliders(forgeTable, 'forge-table')
    expect(slab.center[1] + slab.size[1] / 2).toBeCloseTo(forgeTable.height, 9)
    expect(slab.size).toEqual([forgeTable.length, forgeTable.top + forgeTable.apron[0], forgeTable.depth])
    const legs = rest.filter(({name}) => name === 'forge-table-leg')
    expect(legs).toHaveLength(4)
    for (const {center: [x, , z]} of legs) {
      expect(forgeTable.legs).toContain(x)
      expect(forgeTable.legZ).toContain(z)
    }
  })
})
