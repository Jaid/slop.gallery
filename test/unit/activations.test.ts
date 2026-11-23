import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {GalleryRoomId} from '../../src/worlds/gallery/index.ts'

import {afterEach, expect, test} from 'bun:test'

import {probeGeofences, startGeofences, useGeofences} from '../../src/lib/gallery/geofences.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {whereaboutsAt} from '../../src/lib/gallery/roomVisibility.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import activations, {enabledRooms, floorMirror} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'

const still: Vec3 = [0, 0, 0]
/** the lines the Lobby’s north part ends on and its south part begins on */
const [{z2: northZ}] = slopGallery.dumpGeofences().find(fence => fence.id === 'lobby-north')!.boxes
const [{z: southZ}] = slopGallery.dumpGeofences().find(fence => fence.id === 'lobby-south')!.boxes
const whereabouts = () => useGallery.getState().whereabouts
/** Whether the lamp with the global id shines for a player in the fences. */
const shines = (id: string, fences: ReadonlyArray<string>) => {
  const lamp = slopGallery.lamps().find(candidate => candidate.id === id)!
  return slopGallery.lampFences(lamp).some(fence => fences.includes(fence))
}
afterEach(() => {
  useGeofences.setState(useGeofences.getInitialState(), true)
  useGallery.setState({
    room: slopGallery.defaultRoom,
    whereabouts: [slopGallery.defaultRoom],
  })
})
test('every room’s fence keeps something on, and so do only fences of the gallery', () => {
  for (const {id} of slopGallery.rooms) {
    expect(`${id}: ${Object.hasOwn(activations, id)}`).toBe(`${id}: true`)
  }
  for (const fence of Object.keys(activations)) {
    expect(`${fence}: ${slopGallery.geofences.has(fence)}`).toBe(`${fence}: true`)
  }
})
test('a player in a room may be in the room’s fence and in every other fence sharing space with it, but in no other room’s', () => {
  expect(slopGallery.fencesIn('lobby')).toEqual(['lobby', 'lobby-north', 'lobby-middle', 'lobby-south'])
  expect(slopGallery.fencesIn('moonfall')).toEqual(['moonfall', 'moonfall-stairs'])
  expect(slopGallery.fencesIn('corridor')).toEqual(['corridor', 'corridor-window', 'corridor-seeing_lodge_floor'])
  for (const fence of ['bastion-knight_alley', 'bastion-cistern', 'bastion-gate', 'bastion-seeing_lodge_floor']) {
    expect(slopGallery.fencesIn('bastion')).toContain(fence)
  }
  // The rooms beside the Lobby only share the planes of its walls with its parts, and of whatever the fences of the rooms under it share with them, the Lobby is the player’s room, which the world checks first.
  for (const room of ['vesper', 'banquet', 'antechamber', 'salon', 'forge', 'oculus', 'exhibition']) {
    expect(slopGallery.fencesIn(room)).toEqual([room])
  }
  expect(slopGallery.geofences.get('lobby-north')!.overlaps(slopGallery.room('oculus').fence)).toBe(true)
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
  expect(enabledRooms(['lobby', 'lobby-middle'])).toEqual(lobbyRooms)
  expect(enabledRooms(['arena', 'attic', 'bastion-knight_alley'])).toEqual([])
  expect(enabledRooms([])).toEqual([])
  // each room once, whichever of the fences name it
  expect(enabledRooms(['lobby', 'banquet'])).toEqual([...new Set<GalleryRoomId>([...lobbyRooms, ...activations.banquet.rooms])])
  // The parts of the Lobby add to what the Lobby keeps on.
  expect(enabledRooms(['lobby', 'lobby-north'])).toEqual(lobbyRooms)
  expect(enabledRooms(['lobby', 'lobby-middle', 'lobby-south'])).toEqual([...lobbyRooms, 'moonfall'])
  expect(enabledRooms(['antechamber', 'lobby-south'])).toEqual(activations.antechamber.rooms)
  // The floor mirror is the one the last of them names.
  expect(floorMirror(['lobby'])).toBe('base')
  expect(floorMirror(['lobby', 'lobby-south'])).toBe('base')
  expect(floorMirror(['moonfall', 'moonfall-stairs'])).toBe('moonfall')
  expect(floorMirror(['lobby', 'moonfall'])).toBe('moonfall')
  expect(floorMirror(['moonfall', 'lobby'])).toBe('base')
  // A part of a room decides over the room, which names none.
  expect(floorMirror(['bastion'])).toBeUndefined()
  expect(floorMirror(['bastion', 'bastion-knight_alley', 'bastion-seeing_lodge_floor'])).toBe('lodge')
  expect(floorMirror(['sienna'])).toBeUndefined()
  expect(floorMirror(['arena'])).toBeUndefined()
  expect(floorMirror([])).toBeUndefined()
})
test('walking down the Lobby, the Exhibition’s north tunnel lamp only shines in its north part and Moonfall only stays enabled in its south part', () => {
  const [x, y, z] = slopGallery.spawn.position
  startGeofences([x, y + 0.9, z])
  expect(whereabouts()).toEqual(['lobby', 'lobby-north'])
  let steps = 0
  for (let at = lobby.northZ + 0.05; at < lobby.southZ; at += 0.1) {
    for (const across of [-7.5, 0, 7.5]) {
      probeGeofences([across, 0.9, at], still)
      const north = at <= northZ
      const south = at >= southZ
      expect(whereabouts()).toEqual(['lobby', north ? 'lobby-north' : (south ? 'lobby-south' : 'lobby-middle')])
      expect(`${at.toFixed(2)}: tunnel lamp ${shines('exhibition-tunnel_north', whereabouts()) ? 'on' : 'off'}`).toBe(`${at.toFixed(2)}: tunnel lamp ${north ? 'on' : 'off'}`)
      expect(`${at.toFixed(2)}: Moonfall ${enabledRooms(whereabouts()).includes('moonfall') ? 'enabled' : 'hidden'}`).toBe(`${at.toFixed(2)}: Moonfall ${south ? 'enabled' : 'hidden'}`)
      // A camera at the player’s eyes is in the same fences, so what it draws goes by them too.
      expect(whereaboutsAt([across, 1.62, at])).toEqual([...whereabouts()])
      // What the whole Lobby keeps on stays on all the way: the lamps at the doors of the Exhibition’s staff stairways, and its own chandeliers.
      for (const lamp of ['exhibition-west_stairway_door', 'exhibition-east_stairway_door', 'sienna-chandelier', 'lobby-chandelier_north', 'lobby-chandelier_south']) {
        expect(shines(lamp, whereabouts())).toBe(true)
      }
      expect(enabledRooms(whereabouts())).toContain('exhibition')
      expect(shines('exhibition-tunnel_middle', whereabouts())).toBe(false)
      steps++
    }
  }
  expect(steps).toBe(1200)
  // On the lines between its parts, the player is in both of them, and both add what they keep on.
  probeGeofences([0, 0.9, northZ], still)
  expect(whereabouts()).toEqual(['lobby', 'lobby-north', 'lobby-middle'])
  expect(shines('exhibition-tunnel_north', whereabouts())).toBe(true)
  probeGeofences([0, 0.9, southZ], still)
  expect(whereabouts()).toEqual(['lobby', 'lobby-middle', 'lobby-south'])
  expect(enabledRooms(whereabouts())).toContain('moonfall')
  // Where the lamp and Moonfall are at home, and wherever else keeps them on, nothing changed.
  for (const room of ['exhibition', 'moonfall', 'oculus']) {
    expect(shines('exhibition-tunnel_north', [room])).toBe(true)
  }
  expect(shines('exhibition-tunnel_north', ['vesper'])).toBe(false)
  for (const {id} of slopGallery.rooms) {
    expect(`${id}: ${enabledRooms(slopGallery.fencesIn(id)).includes('moonfall')}`).toBe(`${id}: ${['antechamber', 'exhibition', 'lobby', 'oculus'].includes(id)}`)
  }
})
