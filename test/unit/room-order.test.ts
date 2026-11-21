import type {GalleryRoomId} from '../../src/worlds/gallery/index.ts'

import {expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {nearestFirst} from '../../src/components/World/index.tsx'
import gallery from '../../src/worlds/gallery/index.ts'

const eyeAtSpawn = (id: GalleryRoomId) => {
  const [x, y, z] = gallery.room(id).spawn.position
  return new Vector3(x, y + 1.6, z)
}
/** how many openings each room lies away from the rooms of `from` */
const hopsFrom = (from: ReadonlyArray<GalleryRoomId>) => {
  const hops = new Map<GalleryRoomId, number>(from.map(room => [room, 0]))
  for (let depth = 1, round = [...from]; round.length; depth++) {
    round = [...new Set(round.flatMap(room => gallery.neighbors(room)))].filter(room => !hops.has(room))
    for (const room of round) {
      hops.set(room, depth)
    }
  }
  return hops
}
test('the Lobby asks for every room, its own first, the rooms fewer openings away before those further away', () => {
  const order = nearestFirst(['lobby'], eyeAtSpawn('lobby'))
  expect(order[0]).toBe('lobby')
  expect(order.toSorted()).toEqual(gallery.rooms.map(room => room.id).toSorted())
  const hops = hopsFrom(['lobby'])
  for (let index = 1; index < order.length; index++) {
    expect(hops.get(order[index])!).toBeGreaterThanOrEqual(hops.get(order[index - 1])!)
  }
})
test('a passage starts from both its rooms, the one the eye is in first, also without a starting room', () => {
  const eye = eyeAtSpawn('oculus')
  expect(nearestFirst(['lobby', 'oculus'], eye).slice(0, 2)).toEqual(['oculus', 'lobby'])
  expect(nearestFirst([], eye)[0]).toBe('oculus')
})
