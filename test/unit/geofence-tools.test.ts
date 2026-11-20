import type {Vec3} from '../../src/lib/gallery/types.ts'
import type World from '../../src/worlds/base/World.ts'

import {afterEach, expect, test} from 'bun:test'

import {BeamBox, createBox, SkyBox, VoidBox} from 'geofency'

import {bodyPose} from '../../src/lib/gallery/actions.ts'
import getGeofences from '../../src/lib/webmcp/getGeofences.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

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
test('the dump lists every fence of a world in its order with all of its boxes as plain data, a tenth of a millimeter exact', () => {
  for (const world of worlds) {
    const dump = world.dumpGeofences()
    // Its rooms’ fences first, then its other ones
    expect(dump.map(({id}) => id)).toEqual(world.geofences.keys().toArray())
    expect(dump.slice(0, world.rooms.length).map(({id}) => id)).toEqual(world.rooms.map(({id}) => id))
    for (const {id, boxes} of dump) {
      const fence = world.geofences.get(id)!
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
  expect(boxes('lobby')).toEqual([{
    x: -8,
    x2: 8,
    z: -32,
    z2: 8,
    floor: -0.2,
  }])
  // under its floor plan up to its ceiling, and its stairway at every height
  expect(boxes('moonfall').map(box => createBox(box).constructor)).toEqual([VoidBox, BeamBox])
  expect(boxes('lobby').map(box => createBox(box).constructor)).toEqual([SkyBox])
  expect(boxes('bastion').every(box => 'y' in box && box.y < box.y2)).toBe(true)
  // Its other fences: the Lobby’s parts from the slab up like the Lobby, the stairway over Moonfall’s ceiling and, beyond its hall, at every height, the parts of the Bastion in the Bastion’s own boxes around them, and the Corridor’s hall abreast of the Lodge’s window between heights
  expect(dump.slice(slopGallery.rooms.length).map(({id}) => id)).toEqual(['lobby_north', 'lobby_middle', 'lobby_south', 'moonfall_stairs', 'knight_alley', 'bastion_cistern', 'bastion_gate', 'corridor_window'])
  expect(boxes('lobby_north')).toEqual([{
    x: -8,
    x2: 8,
    z: -32,
    z2: -16,
    floor: -0.2,
  }])
  expect(boxes('lobby_middle')).toEqual([{
    x: -8,
    x2: 8,
    z: -16,
    z2: -10,
    floor: -0.2,
  }])
  expect(boxes('lobby_south')).toEqual([{
    x: -8,
    x2: 8,
    z: -10,
    z2: 8,
    floor: -0.2,
  }])
  expect(boxes('moonfall_stairs').map(box => createBox(box).constructor)).toEqual([SkyBox, BeamBox])
  expect(boxes('knight_alley')).toHaveLength(2)
  expect(boxes('bastion_cistern')).toHaveLength(8)
  for (const box of [...boxes('knight_alley'), ...boxes('bastion_cistern')]) {
    expect(boxes('bastion')).toContainEqual(box)
  }
  expect(boxes('bastion_gate').length).toBeGreaterThan(10)
  expect(boxes('bastion_gate').every(box => 'y' in box && box.y < box.y2)).toBe(true)
  expect(boxes('corridor_window')).toHaveLength(1)
  expect(boxes('corridor_window').every(box => 'y' in box && box.y < box.y2)).toBe(true)
})
test('the fences at a position are all that hold it, the rooms’ first, by default the player’s place', () => {
  const [x, y, z] = slopGallery.spawn.position
  // in the Lobby’s north part, where visitors arrive
  expect(getGeofences()).toEqual(['lobby', 'lobby_north'])
  expect(getGeofences({})).toEqual(['lobby', 'lobby_north'])
  expect(getGeofences(toPosition([x, y + 1, z]))).toEqual(['lobby', 'lobby_north'])
  // on the plane of the wall between the Lobby and the Vesper, which the fences of both end at, in the Lobby’s south part
  expect(getGeofences(toPosition([-8, 1.5, 0]))).toEqual(['lobby', 'vesper', 'lobby_south'])
  // on the lines between the Lobby’s parts, and beside its fountain between them
  expect(getGeofences(toPosition([0, 1.5, -16]))).toEqual(['lobby', 'lobby_north', 'lobby_middle'])
  expect(getGeofences(toPosition([3, 1.5, -12]))).toEqual(['lobby', 'lobby_middle'])
  expect(getGeofences(toPosition([0, 1.5, -10]))).toEqual(['lobby', 'lobby_middle', 'lobby_south'])
  // under the Lobby’s glazed floor
  expect(getGeofences(toPosition([0, -5, -27]))).toEqual(['oculus'])
  // in the knight’s alley, the Bastion’s blind branch beside the Lodge, which a fence of its own marks
  expect(getGeofences(toPosition([-16.93, -4.1, -33]))).toEqual(['bastion', 'knight_alley'])
  // in the Bastion’s cistern, and on the turn of the stairway down to Moonfall
  expect(getGeofences(toPosition([-18.15, 1.8, -41]))).toEqual(['bastion', 'bastion_cistern'])
  expect(getGeofences(toPosition([18.5, -3.1, 15]))).toEqual(['moonfall', 'moonfall_stairs'])
  expect(getGeofences(toPosition([900, 900, 900]))).toEqual([])
  bodyPose.place = [14, 1.5, 0]
  expect(getGeofences()).toEqual(['banquet'])
  bodyPose.place = [900, 900, 900]
  expect(getGeofences()).toEqual([])
  for (const position of [[x, y + 1, z], [-8, 1.5, 0], [-20, 0, -32], [0, -5, -27], [-16.93, -4.1, -33], [-18.15, 1.8, -41], [18.5, -3.1, 15], [0, 1.5, -16], [3, 1.5, -12], [0, 1.5, -10], [900, 900, 900]] satisfies Array<Vec3>) {
    expect(getGeofences(toPosition(position))).toEqual(slopGallery.geofences.getMatches(position))
  }
})
