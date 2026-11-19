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
    expect(dump.map(({id}) => id)).toEqual(world.rooms.map(({id}) => id))
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
})
test('the fences at a position are those of every room holding it, by default the player’s place', () => {
  const [x, y, z] = slopGallery.spawn.position
  expect(getGeofences()).toEqual(['lobby'])
  expect(getGeofences({})).toEqual(['lobby'])
  expect(getGeofences(toPosition([x, y + 1, z]))).toEqual(['lobby'])
  // on the plane of the wall between the Lobby and the Vesper, which the fences of both end at
  expect(getGeofences(toPosition([-8, 1.5, 0]))).toEqual(['lobby', 'vesper'])
  // under the Lobby’s glazed floor
  expect(getGeofences(toPosition([0, -5, -27]))).toEqual(['oculus'])
  expect(getGeofences(toPosition([900, 900, 900]))).toEqual([])
  bodyPose.place = [14, 1.5, 0]
  expect(getGeofences()).toEqual(['banquet'])
  bodyPose.place = [900, 900, 900]
  expect(getGeofences()).toEqual([])
  for (const position of [[x, y + 1, z], [-8, 1.5, 0], [-20, 0, -32], [0, -5, -27], [900, 900, 900]] satisfies Array<Vec3>) {
    expect(getGeofences(toPosition(position))).toEqual(slopGallery.geofences.getMatches(position))
  }
})
