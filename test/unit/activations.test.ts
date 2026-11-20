import type {GalleryRoomId} from '../../src/worlds/gallery/index.ts'

import {expect, test} from 'bun:test'

import activations, {enabledRooms, floorMirror} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'

test('every room’s fence keeps something on, and so do only fences of the gallery', () => {
  for (const {id} of slopGallery.rooms) {
    expect(`${id}: ${Object.hasOwn(activations, id)}`).toBe(`${id}: true`)
  }
  for (const fence of Object.keys(activations)) {
    expect(`${fence}: ${slopGallery.geofences.has(fence)}`).toBe(`${fence}: true`)
  }
})
test('a player in a room may be in the room’s fence and in every other fence sharing space with it, but in no other room’s', () => {
  expect(slopGallery.fencesIn('lobby')).toEqual(['lobby', 'lobby_north', 'lobby_middle', 'lobby_south'])
  expect(slopGallery.fencesIn('moonfall')).toEqual(['moonfall', 'moonfall_stairs'])
  expect(slopGallery.fencesIn('corridor')).toEqual(['corridor', 'corridor_window'])
  for (const fence of ['knight_alley', 'bastion_cistern', 'bastion_gate']) {
    expect(slopGallery.fencesIn('bastion')).toContain(fence)
  }
  // The rooms beside the Lobby only share the planes of its walls with its parts, and of whatever the fences of the rooms under it share with them, the Lobby is the player’s room, which the world checks first.
  for (const room of ['vesper', 'banquet', 'antechamber', 'salon', 'forge', 'oculus', 'exhibition']) {
    expect(slopGallery.fencesIn(room)).toEqual([room])
  }
  expect(slopGallery.geofences.get('lobby_north')!.overlaps(slopGallery.room('oculus').fence)).toBe(true)
  // Every fence that is no room’s lies in a room, and those that keep something on in just one, which they add to.
  for (const fence of slopGallery.geofences.keys().filter(id => !slopGallery.roomById(id))) {
    const rooms = slopGallery.rooms.filter(room => slopGallery.fencesIn(room.id).includes(fence)).map(room => room.id)
    expect(rooms.length).toBeGreaterThan(0)
    if (Object.hasOwn(activations, fence)) {
      expect(`${fence} lies in ${rooms.join(', ')}`).toBe(`${fence} lies in ${rooms[0]}`)
    }
  }
  expect(slopGallery.fencesIn('attic')).toEqual([])
  expect(knottingham.fencesIn('arena')).toEqual(['arena'])
})
test('whatever any of the fences the player is in keeps on is on', () => {
  const lobbyRooms = activations.lobby.rooms
  expect(enabledRooms(['lobby'])).toEqual(lobbyRooms)
  expect(enabledRooms(new Set(['lobby']))).toEqual(lobbyRooms)
  // A fence that keeps nothing on adds nothing, like the Lobby’s middle part or a fence of another world.
  expect(enabledRooms(['lobby', 'lobby_middle'])).toEqual(lobbyRooms)
  expect(enabledRooms(['arena', 'attic', 'knight_alley'])).toEqual([])
  expect(enabledRooms([])).toEqual([])
  // Each room once, whichever of the fences name it
  expect(enabledRooms(['lobby', 'banquet'])).toEqual([...new Set<GalleryRoomId>([...lobbyRooms, ...activations.banquet.rooms])])
  // The floor mirror is the one the last of them names.
  expect(floorMirror(['lobby'])).toBe('base')
  expect(floorMirror(['lobby', 'lobby_south'])).toBe('base')
  expect(floorMirror(['moonfall', 'moonfall_stairs'])).toBe('moonfall')
  expect(floorMirror(['lobby', 'moonfall'])).toBe('moonfall')
  expect(floorMirror(['moonfall', 'lobby'])).toBe('base')
  expect(floorMirror(['sienna'])).toBeUndefined()
  expect(floorMirror(['arena'])).toBeUndefined()
  expect(floorMirror([])).toBeUndefined()
})
