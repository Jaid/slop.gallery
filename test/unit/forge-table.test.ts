import type {IronTable} from '../../src/lib/gallery/ironTable.ts'
import type {Wall} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import {Matrix4, Vector3} from 'three/webgpu'

import {cannonFlight, machineBody, workbench} from '../../src/lib/gallery/alchemy/alchemyMachine.ts'
import WorkbenchGeometry from '../../src/lib/gallery/alchemy/WorkbenchGeometry.ts'
import {baseboardCapFront, defaultBaseboardHeight, wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import forge, {forgeTable, forgeTableCenter, forgeTableTurn} from '../../src/lib/gallery/forge.ts'
import {ironTableColliders} from '../../src/lib/gallery/ironTable.ts'
import IronTableGeometry from '../../src/lib/gallery/IronTableGeometry.ts'
import {wallCoordinates, wallOffset} from '../../src/lib/placement/wallGeometry.ts'
import forgeSpawns from '../../src/rooms/forge/spawns.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const [tableX, tableZ] = forgeTableCenter
const [benchX, benchZ] = workbench.center
const west = slopGallery.walls.find(wall => wall.id === 'forge-west')!
const south = slopGallery.walls.find(wall => wall.id === 'forge-south')!
/** the floor’s brass inlay runs this far out of every wall’s center line */
const inlayOffset = 1.25 - 0.013
/** The extremes of a table’s geometry, turned and placed in the world: how near and how far from the wall’s center line it reaches, below the baseboard’s top and over all. */
function wallReach({frame, top}: IronTableGeometry, wall: Wall, [x, z]: readonly [number, number], turn: number) {
  const placement = new Matrix4
  placement.makeRotationY(turn).setPosition(x, 0, z)
  const point = new Vector3
  let nearestLow = Infinity
  let farthestLow = -Infinity
  let nearest = Infinity
  for (const geometry of [frame, top]) {
    const position = geometry.getAttribute('position')
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(placement)
      const offset = wallOffset(wall, [point.x, point.y, point.z])
      nearest = Math.min(nearest, offset)
      if (point.y >= defaultBaseboardHeight + 0.01) {
        continue
      }
      nearestLow = Math.min(nearestLow, offset)
      farthestLow = Math.max(farthestLow, offset)
    }
  }
  return {
    farthestLow,
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
    test(`${name} is of iron, standing clear of the wall’s baseboard, its slab reaching back out over it, short of the wall’s face`, () => {
      const geometry = build()
      try {
        const {farthestLow, nearest, nearestLow} = wallReach(geometry, wall, center, turn)
        expect(nearestLow - baseboardCapFront).toBeGreaterThan(0.005)
        expect(nearestLow - baseboardCapFront).toBeLessThan(0.03)
        expect(nearest).toBeLessThan(baseboardCapFront)
        expect(nearest).toBeGreaterThan(wallFace + 0.02)
        // Its feet stay off the floor’s brass inlay.
        expect(farthestLow).toBeLessThan(inlayOffset)
        expect(geometry.top.hasAttribute('woodGrain')).toBe(false)
        expect(geometry.frame.hasAttribute('woodGrain')).toBe(false)
        // Its slab rests on the band under it, as high as the table is.
        geometry.top.computeBoundingBox()
        expect(geometry.top.boundingBox!.max.y).toBeCloseTo(table.height, 6)
        expect(geometry.top.boundingBox!.min.y).toBeCloseTo(table.height - table.top, 6)
      } finally {
        geometry.dispose()
      }
    })
  }
  test('the workbench’s frame stands clear of the alchemy machine’s body between its legs', () => {
    const [width, height, depth] = machineBody.size
    const [x, z] = machineBody.center
    // The body with its bands and rivets round it
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
  test('both are larger than the wooden ones they replace', () => {
    expect(forgeTable.length).toBeGreaterThan(1.8)
    expect(forgeTable.depth).toBeGreaterThan(0.8)
    expect(workbench.length).toBeGreaterThan(2.8)
    expect(workbench.depth).toBeGreaterThan(1.1)
  })
})
describe('the Forge’s painter’s table', () => {
  test('stands in the Forge against the middle of its west wall, running along it', () => {
    expect(slopGallery.roomAt([tableX, 0.5, tableZ])?.id).toBe('forge')
    expect(wallCoordinates(west, [tableX, 0, tableZ])).toBeCloseTo(0, 9)
    expect(forgeTable.legs).toHaveLength(2)
    // Its length runs along the wall, its back toward it.
    const up = new Vector3(0, 1, 0)
    const along = new Vector3(1, 0, 0)
    const back = new Vector3(0, 0, 1)
    along.applyAxisAngle(up, forgeTableTurn)
    back.applyAxisAngle(up, forgeTableTurn)
    expect(Math.abs(along.z)).toBeCloseTo(1, 9)
    expect(back.x).toBeCloseTo(-1, 9)
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
  test('keeps works from hanging on the stretch of the wall behind it', () => {
    const reservation = west.reservations?.find(({u, width}) => Math.abs(u) < 1e-9 && Math.abs(width - forgeTable.length) < 1e-9)
    expect(reservation?.height).toBeCloseTo(forgeTable.height + 0.1, 9)
    expect(reservation?.bottom).toBeUndefined()
  })
  test('stands out of the alchemy machine’s way, the cannon’s shot and where visitors arrive', () => {
    const reach = Math.hypot(forgeTable.depth, forgeTable.length) / 2
    for (const [x, , z] of cannonFlight.points) {
      expect(Math.hypot(x - tableX, z - tableZ)).toBeGreaterThan(reach + 3)
    }
    expect(Math.abs(benchX - tableX) - (workbench.length + forgeTable.depth) / 2).toBeGreaterThan(2)
    expect(Math.abs(benchZ - tableZ)).toBeGreaterThan(5)
    const [spawnX, , spawnZ] = forgeSpawns[''].position
    expect(Math.hypot(forge.center[0] + spawnX - tableX, forge.center[1] + spawnZ - tableZ)).toBeGreaterThan(8)
  })
})
