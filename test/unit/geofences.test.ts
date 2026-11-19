import type {Vec3} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {Geofence} from 'geofency'
import {Box3} from 'three/webgpu'

import {climbApproach, climbRun} from '../../src/lib/gallery/climb.ts'
import {forgeVestibule} from '../../src/lib/gallery/forge.ts'
import {lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import tunnelDisplays from '../../src/lib/gallery/tunnelDisplays.ts'
import Cell from '../../src/rooms/cell/Cell.ts'
import CellLayout from '../../src/rooms/cell/CellLayout.ts'
import World from '../../src/worlds/base/World.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {worlds} from '../../src/worlds/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

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
}, 30_000)
test('the Lodge’s window niche belongs to the Lodge, out to the glass in the Corridor’s lining', () => {
  const sill = lodgeWindow.bottom + 0.2
  for (const x of [lodgeWindow.roomX - 0.2, (lodgeWindow.roomX + lodgeWindow.tunnelX) / 2, lodgeWindow.tunnelX + 0.05]) {
    expect(slopGallery.roomAt([x, sill, lodgeWindow.z])?.id).toBe('lodge')
  }
  expect(slopGallery.roomAt([lodgeWindow.tunnelX - 0.3, sill, lodgeWindow.z])?.id).toBe('corridor')
})
test('the balcony’s middle stays the Oculus’, the staff stairways behind the doors at its ends are the Exhibition’s', () => {
  const {door} = tunnelDisplays[0].stairway
  const over = door[1] + 1.6
  expect(slopGallery.roomAt([0, over, door[2]])?.id).toBe('oculus')
  for (const side of [-1, 1]) {
    expect(slopGallery.roomAt([side * (Math.abs(door[0]) - 0.5), over, door[2]])?.id).toBe('oculus')
    expect(slopGallery.roomAt([side * (Math.abs(door[0]) + 0.5), over, door[2]])?.id).toBe('exhibition')
  }
})
/** The sides of a fence’s box by their names, in the names’ order. */
const sides = (box: object) => Object.entries(box).toSorted(([a], [b]) => a.localeCompare(b)) as Array<[string, number]>
/** A world of a single Cell with fences beside its room’s. */
class FencedWorld extends World<Cell> {
  override readonly artworks = []
  override readonly defaultRoom = 'cell'
  override readonly id = 'sandbox'
  override readonly Minimap = sandbox.Minimap
  override readonly placement = sandbox.placement
  override readonly Scene = sandbox.Scene

  constructor(fences: Record<string, Geofence>) {
    super(worlds.sandbox, [[new Cell(new CellLayout(0)), [0, 0, 0]]], fences)
  }

  override contains() {
    return true
  }

  override floorHeight() {
    return 0
  }

  override wallDistance() {
    return Infinity
  }
}
test('a world’s other fences come after its rooms’, under ids of their own, and never stand in for a room', () => {
  expect(knottingham.geofences.keys().toArray()).toEqual(['arena'])
  expect(sandbox.geofences.keys().toArray()).toEqual(['cell'])
  expect(slopGallery.geofences.keys().toArray()).toEqual([...slopGallery.rooms.map(room => room.id), 'imminent_forge'])
  // A fence reaching beyond the Cell and one far outside of it
  const corner = new Geofence([{
    x: 0,
    z: 0,
    x2: 90,
    z2: 90,
  }])
  const far = new Geofence([{
    x: 500,
    z: 500,
    x2: 600,
    z2: 600,
  }])
  const world = new FencedWorld({
    corner,
    far,
  })
  expect(world.geofences.keys().toArray()).toEqual(['cell', 'corner', 'far'])
  expect(world.geofences.getMatches([1, 1, 1])).toEqual(['cell', 'corner'])
  expect(world.roomAt([1, 1, 1])?.id).toBe('cell')
  expect(world.geofences.getMatches([80, 1, 80])).toEqual(['corner'])
  expect(world.roomAt([80, 1, 80])).toBeUndefined()
  expect(world.roomById('corner')).toBeUndefined()
  expect(() => new FencedWorld({cell: far})).toThrow('id of its own')
})
test('the gallery’s imminent_forge fences the Bastion’s approach to the Forge’s vestibule, within the Bastion’s fence, short of the run before it and of the vestibule', () => {
  const fence = slopGallery.geofences.get('imminent_forge')!
  const bastion = slopGallery.room('bastion').fence
  const {route, width} = climbApproach
  // Along the whole approach from wall to wall, wherever a body is, standing, crouching or jumping
  for (let along = 0.05; along < route.length; along += 0.1) {
    const {point: [x, z], heading, y} = route.at(along)
    for (const across of [-1, 0, 1]) {
      const side = across * (width / 2 - 0.4)
      for (const height of [0.05, 0.9, 1.75, 2.9]) {
        const position: Vec3 = [x - Math.sin(heading) * side, y + height, z + Math.cos(heading) * side]
        // The Bastion’s, and here and there the Lodge’s, whose fence reaches up through its roof
        const matches = slopGallery.geofences.getMatches(position)
        expect(matches.filter(id => id !== 'lodge')).toEqual(['bastion', 'imminent_forge'])
        expect(slopGallery.roomAt(position)?.id).toBe('bastion')
      }
    }
  }
  // Its boxes are the Bastion’s own around the approach, but for the rounding of the Bastion’s way from its origin and back, so the Bastion’s fence holds all of it.
  expect(fence.boxes).toHaveLength(climbApproach.chunks(0.35).length)
  for (const box of fence.boxes) {
    const twins = bastion.boxes.filter(candidate => sides(candidate).every(([side, value], index) => side === sides(box)[index][0] && Math.abs(value - sides(box)[index][1]) < 1e-9))
    expect(twins).toHaveLength(1)
  }
  // The run north ends where the approach begins, and the vestibule begins where the approach ends, in the plane touching its wall.
  const [runX, runZ] = route.start
  expect(climbRun.route.end.point).toEqual([runX, runZ])
  expect(fence.contains([runX, 0.9, runZ + 0.01])).toBe(false)
  expect(fence.contains([runX, 0.9, runZ - 0.01])).toBe(true)
  const [endX, endZ] = route.end.point
  expect(endX).toBe(forgeVestibule.center[0] - forgeVestibule.radius)
  expect(fence.contains([endX - 0.01, 0.9, endZ])).toBe(true)
  expect(fence.contains([endX + 0.01, 0.9, endZ])).toBe(false)
  expect(slopGallery.geofences.getMatches([endX + 0.01, 0.9, endZ])).toEqual(['forge'])
  // Neither the Bastion’s passages under it nor anything over its vault
  expect(fence.contains([runX, -3, runZ - 2])).toBe(false)
  expect(fence.contains([runX, 6, runZ - 2])).toBe(false)
  for (const room of slopGallery.rooms) {
    if (!(room.id !== 'bastion')) {
      continue
    }
    const [x, y, z] = room.spawn.position
    expect(fence.contains([x, y + 0.9, z])).toBe(false)
  }
})
