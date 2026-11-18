import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {GalleryRoomId as RoomId} from '../../src/worlds/gallery/index.ts'

import {expect, test} from 'bun:test'

import {byDistance, nearestFirst} from '../../src/components/World/index.tsx'
import {roomBoxes, roomContaining} from '../../src/lib/gallery/roomVisibility.ts'
import {perceptualDistanceToBox} from '../../src/lib/perceptualDistance.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import relations from '../../src/worlds/gallery/relations.ts'

const rooms = slopGallery.rooms.map((room): RoomId => room.id)
/** the middle of the room’s first box of air at eye height, if that lies in this room alone */
const inside = (room: RoomId): Vec3 | undefined => {
  const {box, floorY} = roomBoxes.find(({id}) => id === room)!
  const middle: Vec3 = [(box.min.x + box.max.x) / 2, floorY + 1.6, (box.min.z + box.max.z) / 2]
  return roomContaining(middle) === room ? middle : undefined
}
const distance = (room: RoomId, point: Vec3) => Math.min(...roomBoxes.filter(({id}) => id === room).map(({box}) => perceptualDistanceToBox(point, box)))
test('rooms are sorted by how far a walk to their nearest air feels', () => {
  for (const room of rooms) {
    const point = inside(room)
    if (!point) {
      continue
    }
    const sorted = byDistance(rooms, point)
    expect(sorted[0]).toBe(room)
    expect(sorted.toSorted()).toEqual(rooms.toSorted())
    const distances = sorted.map(other => distance(other, point))
    expect(distances).toEqual(distances.toSorted((a, b) => a - b))
  }
})
test('rooms mount the camera’s first, then by how many openings away they are, the nearest of each round first', () => {
  for (const room of rooms) {
    const point = inside(room)
    if (!point) {
      continue
    }
    const order = nearestFirst([room], point)
    expect(order[0]).toBe(room)
    expect(order.toSorted()).toEqual(rooms.toSorted())
    // The rooms the camera’s room sees into come right after it, nearest first.
    const seen = [...new Set(relations[room].rooms.filter(other => other !== room))]
    const neighbors = order.slice(1, 1 + seen.length)
    expect(neighbors.toSorted()).toEqual(seen.toSorted())
    expect(neighbors.map(other => distance(other, point))).toEqual(neighbors.map(other => distance(other, point)).toSorted((a, b) => a - b))
  }
})
test('outside of every room, the rooms mount nearest first', () => {
  const point: Vec3 = [0, 60, 0]
  const order = nearestFirst([], point)
  expect(order).toEqual(byDistance(rooms, point))
})
