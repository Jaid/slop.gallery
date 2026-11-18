import type {GalleryRoomId} from '../../src/worlds/gallery/index.ts'

import {expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {nearestFirst} from '../../src/components/World/index.tsx'
import gallery from '../../src/worlds/gallery/index.ts'

const eyeAtSpawn = (id: GalleryRoomId) => {
  const [x, y, z] = gallery.room(id).spawn.position
  return new Vector3(x, y + 1.6, z)
}
test('the Lobby asks for the nearer rooms within a hop before a physically close room two hops away', () => {
  const order = nearestFirst(['lobby'], eyeAtSpawn('lobby'))
  expect(order.slice(0, 4)).toEqual(['lobby', 'forge', 'oculus', 'salon'])
  // The Lodge is closer than Moonfall in meters, but Moonfall is one hop from the Lobby.
  expect(order.indexOf('moonfall')).toBeLessThan(order.indexOf('lodge'))
  expect(order.toSorted()).toEqual(gallery.rooms.map(room => room.id).toSorted())
})
test('a passage starts from both its rooms; without a starting room only walking distance decides', () => {
  const eye = eyeAtSpawn('oculus')
  expect(nearestFirst(['lobby', 'oculus'], eye).slice(0, 2)).toEqual(['oculus', 'lobby'])
  // The nearest part of the Exhibition is a passage, away from the center of the room.
  expect(nearestFirst([], eye).slice(0, 4)).toEqual(['oculus', 'exhibition', 'bastion', 'lobby'])
})
