import type {Vec3} from '../../src/lib/gallery/types.ts'
import type World from '../../src/worlds/base/World.ts'

import {afterEach, expect, test} from 'bun:test'

import {BeamBox, createBox, RelationalGeofence, SkyBox, VoidBox} from 'geofency'

import {bodyPose} from '../../src/lib/gallery/actions.ts'
import getGeofences from '../../src/lib/webmcp/getGeofences.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/cell.ts'

const worlds: ReadonlyArray<World> = [slopGallery, knottingham, sandbox]
const place = bodyPose.place
afterEach(() => {
  bodyPose.place = place
})
const toPosition = ([x, y, z]: Vec3) => ({position: {
  x,
  y,
  z,
}})
test('the dump lists every fence of a world in its order with all of its own boxes as plain data, a tenth of a millimeter exact, and the relations of a relational one', () => {
  for (const world of worlds) {
    const dump = world.dumpGeofences()
    // its rooms’ fences first, then its other ones
    expect(dump.map(({id}) => id)).toEqual(world.geofences.keys().toArray())
    expect(dump.slice(0, world.rooms.length).map(({id}) => id)).toEqual(world.rooms.map(({id}) => id))
    for (const {id, boxes, relations} of dump) {
      const fence = world.geofences.get(id)!
      expect(relations).toEqual(fence instanceof RelationalGeofence ? [...fence.relations] : undefined)
      expect(boxes).toHaveLength(fence.boxes.length)
      for (const [index, data] of boxes.entries()) {
        const box = fence.boxes[index]
        // Plain data, which builds a box of the same kind again that reaches up and down as far.
        expect(Object.getPrototypeOf(data)).toBe(Object.prototype)
        expect(createBox(data)).toBeInstanceOf(box.constructor)
        expect(Object.keys(data).toSorted()).toEqual(Object.keys(box).toSorted())
        for (const [key, value] of Object.entries(data)) {
          expect(Math.abs(value - (box as unknown as Record<string, number>)[key])).toBeLessThanOrEqual(5.000001e-5)
          expect(Math.abs(value * 1e4 - Math.round(value * 1e4))).toBeLessThan(1e-6)
        }
      }
    }
  }
})
test('the gallery’s dump tells its fences apart by how far their boxes reach', () => {
  const dump = slopGallery.dumpGeofences()
  const boxes = (id: string) => dump.find(fence => fence.id === id)!.boxes
  // The Lobby is its parts alone, and no other fence relates to any.
  expect(dump.find(fence => fence.id === 'lobby')).toEqual({
    id: 'lobby',
    boxes: [],
    relations: ['lobby-north', 'lobby-middle', 'lobby-south'],
  })
  expect(dump.filter(fence => fence.relations).map(({id}) => id)).toEqual(['lobby'])
  // under its floor plan up to its ceiling, and its stairway at every height
  expect(boxes('moonfall').map(box => createBox(box).constructor)).toEqual([VoidBox, BeamBox, BeamBox, BeamBox])
  for (const part of ['lobby-north', 'lobby-middle', 'lobby-south']) {
    expect(boxes(part).map(box => createBox(box).constructor)).toEqual([SkyBox])
  }
  expect(boxes('bastion').every(box => 'y' in box && box.y < box.y2)).toBe(true)
  expect(boxes('exhibition')).toHaveLength(4)
  expect(boxes('corridor')).toHaveLength(52)
  // its other fences: the Lobby’s parts from the slab up like the Lobby, the flights and return outside Moonfall’s hall at every height, the parts of the Bastion in the Bastion’s own boxes around them, and the Corridor’s hall abreast of the Lodge’s window between heights
  expect(dump.slice(slopGallery.rooms.length).map(({id}) => id)).toEqual(['lobby-north', 'lobby-middle', 'lobby-south', 'moonfall-stairs', 'bastion-knight_alley', 'bastion-cistern', 'bastion-gate', 'bastion-seeing_lodge_floor', 'corridor-window', 'corridor-seeing_lodge_floor'])
  expect(boxes('lobby-north')).toEqual([{
    x: -8,
    x2: 8,
    z: -32,
    z2: -20,
    floor: -0.2,
  }])
  expect(boxes('lobby-middle')).toEqual([{
    x: -8,
    x2: 8,
    z: -20,
    z2: -1.5,
    floor: -0.2,
  }])
  expect(boxes('lobby-south')).toEqual([{
    x: -8,
    x2: 8,
    z: -1.5,
    z2: 8,
    floor: -0.2,
  }])
  expect(boxes('moonfall-stairs').map(box => createBox(box).constructor)).toEqual([BeamBox, BeamBox, BeamBox])
  expect(boxes('bastion-knight_alley')).toHaveLength(1)
  expect(boxes('bastion-cistern')).toHaveLength(1)
  for (const box of [...boxes('bastion-knight_alley'), ...boxes('bastion-cistern')]) {
    expect(boxes('bastion')).toContainEqual(box)
  }
  expect(boxes('bastion-gate').length).toBeGreaterThan(10)
  expect(boxes('bastion-gate').every(box => 'y' in box && box.y < box.y2)).toBe(true)
  expect(boxes('corridor-window')).toHaveLength(1)
  expect(boxes('corridor-window').every(box => 'y' in box && box.y < box.y2)).toBe(true)
})
test('the fences at a position are all that hold it, the rooms’ first, by default the player’s place', () => {
  const [x, y, z] = slopGallery.spawn.position
  // in the Lobby’s north part, where visitors arrive
  expect(getGeofences()).toEqual(['lobby', 'lobby-north'])
  expect(getGeofences({})).toEqual(['lobby', 'lobby-north'])
  expect(getGeofences(toPosition([x, y + 1, z]))).toEqual(['lobby', 'lobby-north'])
  // on the plane of the wall between the Lobby and the Vesper, which the fences of both end at, in the Lobby’s south part
  expect(getGeofences(toPosition([-8, 1.5, 0]))).toEqual(['lobby', 'vesper', 'lobby-south'])
  // on the lines between the Lobby’s parts, and beside its fountain between them
  expect(getGeofences(toPosition([0, 1.5, -20]))).toEqual(['lobby', 'lobby-north', 'lobby-middle'])
  expect(getGeofences(toPosition([3, 1.5, -12]))).toEqual(['lobby', 'lobby-middle'])
  expect(getGeofences(toPosition([0, 1.5, -1.5]))).toEqual(['lobby', 'lobby-middle', 'lobby-south'])
  // under the Lobby’s glazed floor
  expect(getGeofences(toPosition([0, -5, -27]))).toEqual(['oculus'])
  // in the knight’s alley, the Bastion’s blind branch beside the Lodge, which a fence of its own marks
  expect(getGeofences(toPosition([-16.93, -4.1, -33]))).toEqual(['bastion', 'bastion-knight_alley', 'bastion-seeing_lodge_floor'])
  // in the Bastion’s cistern, and on the turn of the stairway down to Moonfall
  expect(getGeofences(toPosition([-18.15, 1.8, -41]))).toEqual(['bastion', 'bastion-cistern'])
  expect(getGeofences(toPosition([18.5, -4.2, 21]))).toEqual(['moonfall', 'moonfall-stairs'])
  expect(getGeofences(toPosition([900, 900, 900]))).toEqual([])
  bodyPose.place = [14, 1.5, 0]
  expect(getGeofences()).toEqual(['banquet'])
  bodyPose.place = [900, 900, 900]
  expect(getGeofences()).toEqual([])
  for (const position of [[x, y + 1, z], [-8, 1.5, 0], [-20, 0, -32], [0, -5, -27], [-16.93, -4.1, -33], [-18.15, 1.8, -41], [18.5, -4.2, 21], [0, 1.5, -20], [3, 1.5, -12], [0, 1.5, -1.5], [900, 900, 900]] satisfies Array<Vec3>) {
    expect(getGeofences(toPosition(position))).toEqual(slopGallery.geofences.getMatches(position))
  }
})
