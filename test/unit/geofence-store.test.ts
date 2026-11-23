import type {GeofenceCrossing} from '../../src/lib/gallery/geofences.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, test} from 'bun:test'

import {onGeofenceEnter, onGeofenceLeave, onRoomEnter, probeGeofences, startGeofences, useGeofences} from '../../src/lib/gallery/geofences.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const still: Vec3 = [0, 0, 0]
/** where a standing player’s place is in the Lobby’s south part, on the plane of its wall to the Vesper, in the Vesper, in the Forge and its vestibule, on the Bastion’s run north behind the Forge, in its connecting tunnel in front of the doorway into the knight’s alley, in that alley, and outside of the world */
const places = {
  lobby: [0, 0.9, 0],
  wall: [-8, 0.9, 0],
  vesper: [-14, 0.9, 0],
  forge: [-14, 0.9, -24],
  vestibule: [-14, 0.9, -35],
  run: [-22.3, 0.9, -28],
  link: [-16.93, -4.3, -28],
  alley: [-16.93, -4.1, -33],
  nowhere: [900, 900, 900],
} satisfies Record<string, Vec3>
const fences = () => useGeofences.getState().fences
const room = () => useGallery.getState().room
const whereabouts = () => useGallery.getState().whereabouts
afterEach(() => {
  useGeofences.setState(useGeofences.getInitialState(), true)
  useGallery.setState({
    room: slopGallery.defaultRoom,
    whereabouts: [slopGallery.defaultRoom],
  })
})
test('the player starts in the fences its place lies in without crossing any, in the first room among them, or outside of every fence in the world’s default room', () => {
  expect(useGeofences.getState()).toEqual({
    crossing: null,
    fences: [],
  })
  startGeofences(places.forge)
  expect(useGeofences.getState()).toEqual({
    crossing: null,
    fences: ['forge'],
  })
  expect(room()).toBe('forge')
  startGeofences(places.run)
  expect(fences()).toEqual(['bastion'])
  expect(room()).toBe('bastion')
  startGeofences(places.alley)
  expect(fences()).toEqual(['bastion', 'bastion-knight_alley', 'bastion-seeing_lodge_floor'])
  expect(room()).toBe('bastion')
  startGeofences(places.wall)
  expect(fences()).toEqual(['lobby', 'vesper', 'lobby-south'])
  expect(room()).toBe('lobby')
  startGeofences(places.nowhere)
  expect(fences()).toEqual([])
  expect(room()).toBe('lobby')
})
test('probing takes the player across the fences its place moved over, and only then changes the store', () => {
  startGeofences(places.lobby)
  const states: Array<ReturnType<typeof useGeofences.getState>> = []
  const stop = useGeofences.subscribe(state => states.push(state))
  probeGeofences(places.lobby, still)
  probeGeofences([1, 0.9, 3], [3, 0, -3])
  expect(states).toEqual([])
  const velocity: Vec3 = [-3, 0, 0]
  probeGeofences(places.wall, velocity)
  probeGeofences(places.wall, velocity)
  probeGeofences(places.vesper, velocity)
  probeGeofences([-14.5, 0.9, 0], velocity)
  expect(states).toEqual([
    {
      crossing: {
        position: places.wall,
        velocity,
      },
      fences: ['lobby', 'vesper', 'lobby-south'],
    },
    {
      crossing: {
        position: places.vesper,
        velocity,
      },
      fences: ['vesper'],
    },
  ])
  // The crossing keeps where it happened, whatever becomes of what the scene probed with.
  expect(states[0].crossing!.position).not.toBe(places.wall)
  expect(states[0].crossing!.velocity).not.toBe(velocity)
  stop()
})
test('the player’s room is the first room whose fence holds its place and stays the last one outside of every fence', () => {
  startGeofences(places.lobby)
  const rooms: Array<string> = []
  const stop = useGallery.subscribe((state, previous) => {
    if (state.room !== previous.room) {
      rooms.push(state.room)
    }
  })
  // On the plane of the wall, both rooms hold the place, and the Lobby comes first.
  probeGeofences(places.wall, still)
  expect(fences()).toEqual(['lobby', 'vesper', 'lobby-south'])
  expect(room()).toBe('lobby')
  probeGeofences(places.vesper, still)
  expect(room()).toBe('vesper')
  probeGeofences(places.nowhere, still)
  expect(fences()).toEqual([])
  expect(room()).toBe('vesper')
  probeGeofences(places.vesper, still)
  expect(room()).toBe('vesper')
  probeGeofences(places.run, still)
  expect(fences()).toEqual(['bastion'])
  expect(room()).toBe('bastion')
  // In a fence that is no room’s, the player stays in the room around it.
  probeGeofences(places.alley, still)
  expect(fences()).toEqual(['bastion', 'bastion-knight_alley', 'bastion-seeing_lodge_floor'])
  expect(room()).toBe('bastion')
  probeGeofences(places.vestibule, still)
  expect(room()).toBe('forge')
  expect(rooms).toEqual(['vesper', 'bastion', 'forge'])
  stop()
})
test('crossing between two fences that are no room’s, like the Lobby’s parts, leaves the player in the room', () => {
  startGeofences(places.lobby)
  expect(fences()).toEqual(['lobby', 'lobby-south'])
  const rooms: Array<string> = []
  const stop = useGallery.subscribe((state, previous) => {
    if (state.room !== previous.room) {
      rooms.push(state.room)
    }
  })
  const velocity: Vec3 = [0, 0, -3]
  probeGeofences([0, 0.9, -1.4], velocity)
  expect(useGeofences.getState().crossing).toBeNull()
  probeGeofences([0, 0.9, -1.6], velocity)
  expect(useGeofences.getState()).toEqual({
    crossing: {
      position: [0, 0.9, -1.6],
      velocity,
    },
    fences: ['lobby', 'lobby-middle'],
  })
  probeGeofences([0, 0.9, -20.1], velocity)
  expect(fences()).toEqual(['lobby', 'lobby-north'])
  expect(room()).toBe('lobby')
  expect(rooms).toEqual([])
  stop()
})
test('the player’s whereabouts are its room and every fence that is no room’s holding its place, whatever other rooms’ fences hold it too', () => {
  expect(whereabouts()).toEqual(['lobby'])
  startGeofences(places.lobby)
  expect(whereabouts()).toEqual(['lobby', 'lobby-south'])
  const heard: Array<ReadonlyArray<string>> = []
  const stop = useGallery.subscribe((state, previous) => {
    if (state.whereabouts !== previous.whereabouts) {
      heard.push(state.whereabouts)
    }
  })
  // Moving within the same fences leaves them as they are, the very same list.
  const before = whereabouts()
  probeGeofences([1, 0.9, 3], still)
  expect(whereabouts()).toBe(before)
  // On the line between two parts of the Lobby, the player is in both.
  probeGeofences([0, 0.9, -1.5], still)
  expect(whereabouts()).toEqual(['lobby', 'lobby-middle', 'lobby-south'])
  probeGeofences([0, 0.9, -12], still)
  expect(whereabouts()).toEqual(['lobby', 'lobby-middle'])
  probeGeofences(places.lobby, still)
  // On the plane of the wall, the Vesper’s fence holds the player’s place too, but the player is in the Lobby alone, so the fences stay the same and nobody hears of any.
  probeGeofences(places.wall, still)
  expect(fences()).toEqual(['lobby', 'vesper', 'lobby-south'])
  expect(whereabouts()).toEqual(['lobby', 'lobby-south'])
  probeGeofences(places.vesper, still)
  expect(whereabouts()).toEqual(['vesper'])
  // Outside of every fence, the player stays in the room entered last.
  probeGeofences(places.nowhere, still)
  expect(whereabouts()).toEqual(['vesper'])
  probeGeofences(places.alley, still)
  expect(whereabouts()).toEqual(['bastion', 'bastion-knight_alley', 'bastion-seeing_lodge_floor'])
  expect(heard).toEqual([['lobby', 'lobby-middle', 'lobby-south'], ['lobby', 'lobby-middle'], ['lobby', 'lobby-south'], ['vesper'], ['bastion', 'bastion-knight_alley', 'bastion-seeing_lodge_floor']])
  // A player starting outside of every fence starts in the world’s default room.
  startGeofences(places.nowhere)
  expect(whereabouts()).toEqual(['lobby'])
  stop()
})
test('a fence that is no room’s never is the player’s room, neither after a crossing nor at a start', () => {
  startGeofences(places.vesper)
  // Were it to reach out of every room’s fence, the player would stay in the room entered last, or start in the world’s default room.
  useGeofences.setState({
    crossing: {
      position: places.nowhere,
      velocity: still,
    },
    fences: ['bastion-knight_alley'],
  })
  expect(room()).toBe('vesper')
  expect(whereabouts()).toEqual(['vesper', 'bastion-knight_alley'])
  useGeofences.setState({
    crossing: null,
    fences: ['bastion-knight_alley'],
  })
  expect(room()).toBe('lobby')
  expect(whereabouts()).toEqual(['lobby', 'bastion-knight_alley'])
})
test('whoever hears of a crossing already finds the player in its room and its whereabouts', () => {
  startGeofences(places.run)
  const heard: Array<string> = []
  const stop = useGeofences.subscribe(() => heard.push(`${room()} in ${whereabouts().join(', ')}`))
  probeGeofences(places.vestibule, still)
  probeGeofences(places.alley, still)
  expect(heard).toEqual(['forge in forge', 'bastion in bastion, bastion-knight_alley, bastion-seeing_lodge_floor'])
  stop()
})
test('a fence’s enter listener hears every crossing into it, a room’s or not, but neither a start in it nor staying in it', () => {
  const crossings: Array<GeofenceCrossing> = []
  const stop = onGeofenceEnter('bastion-knight_alley', crossing => crossings.push(crossing))
  startGeofences(places.alley)
  probeGeofences(places.alley, still)
  expect(crossings).toEqual([])
  // back out into the connecting tunnel and in again, all of it in the Bastion
  probeGeofences(places.link, [0, 0, 3])
  expect(fences()).toEqual(['bastion'])
  expect(crossings).toEqual([])
  const velocity: Vec3 = [0, 0, -3]
  probeGeofences(places.alley, velocity)
  probeGeofences([-16.93, -4.1, -34], velocity)
  expect(crossings).toEqual([{
    position: places.alley,
    velocity,
  }])
  expect(room()).toBe('bastion')
  // A room’s fence counts where the room doesn’t yet: on the plane of the wall the Lobby shares with the Vesper, the player is still in the Lobby.
  const heard: Array<string> = []
  const stopVesper = onGeofenceEnter('vesper', () => heard.push(room()))
  probeGeofences(places.lobby, still)
  probeGeofences(places.wall, [-3, 0, 0])
  probeGeofences(places.vesper, [-3, 0, 0])
  expect(heard).toEqual(['lobby'])
  expect(crossings).toHaveLength(1)
  // A player who starts anew elsewhere and then in the alley has crossed nothing.
  startGeofences(places.lobby)
  startGeofences(places.alley)
  expect(crossings).toHaveLength(1)
  stop()
  stopVesper()
  probeGeofences(places.link, still)
  probeGeofences(places.alley, still)
  expect(crossings).toHaveLength(1)
})
test('a fence’s leave listener hears every crossing out of it, a room’s or not, but neither a start outside of it nor staying out of it', () => {
  const crossings: Array<GeofenceCrossing> = []
  const stop = onGeofenceLeave('bastion-knight_alley', crossing => crossings.push(crossing))
  startGeofences(places.alley)
  // Deeper into the alley, the player is still in it.
  probeGeofences([-16.93, -4.1, -34], [0, 0, -3])
  expect(crossings).toEqual([])
  const velocity: Vec3 = [0, 0, 3]
  probeGeofences(places.link, velocity)
  probeGeofences(places.run, velocity)
  expect(crossings).toEqual([{
    position: places.link,
    velocity,
  }])
  // Leaving a room’s fence counts where the player’s room has changed before: from the plane of the wall the Lobby shares with the Vesper, the player comes back out of the Vesper’s fence without ever having been in the Vesper.
  const heard: Array<string> = []
  const stopVesper = onGeofenceLeave('vesper', () => heard.push(room()))
  probeGeofences(places.wall, [-3, 0, 0])
  probeGeofences(places.lobby, [3, 0, 0])
  expect(heard).toEqual(['lobby'])
  expect(crossings).toHaveLength(1)
  // A player in the alley who starts anew elsewhere has crossed nothing.
  startGeofences(places.alley)
  startGeofences(places.lobby)
  expect(crossings).toHaveLength(1)
  stop()
  stopVesper()
  probeGeofences(places.alley, still)
  probeGeofences(places.link, still)
  expect(crossings).toHaveLength(1)
})
test('a room’s enter listener hears the player cross into the room from another one, not into its fence alone, and neither a start in it nor a return from outside of every fence', () => {
  const crossings: Array<GeofenceCrossing> = []
  const stop = onRoomEnter('vesper', crossing => crossings.push(crossing))
  startGeofences(places.vesper)
  probeGeofences([-14.5, 0.9, 0], still)
  expect(room()).toBe('vesper')
  expect(crossings).toEqual([])
  // Out of the world and back: the Vesper stayed the player’s room.
  probeGeofences(places.nowhere, still)
  probeGeofences(places.vesper, still)
  expect(crossings).toEqual([])
  // From the Lobby, the plane of the wall is the Vesper’s fence already, but still the Lobby, which the world checks first.
  const velocity: Vec3 = [-3, 0, 0]
  probeGeofences(places.lobby, [3, 0, 0])
  probeGeofences(places.wall, velocity)
  expect(fences()).toEqual(['lobby', 'vesper', 'lobby-south'])
  expect(crossings).toEqual([])
  probeGeofences(places.vesper, velocity)
  probeGeofences([-14.5, 0.9, 0], velocity)
  expect(crossings).toEqual([{
    position: places.vesper,
    velocity,
  }])
  // Whoever hears of it finds the player in the room, and other rooms’ listeners hear nothing of it.
  const others: Array<string> = []
  const stopOthers = [onRoomEnter('lobby', () => others.push(`lobby from ${room()}`)), onRoomEnter('forge', () => others.push(`forge from ${room()}`))]
  probeGeofences(places.lobby, [3, 0, 0])
  probeGeofences(places.vesper, velocity)
  expect(crossings).toHaveLength(2)
  expect(others).toEqual(['lobby from lobby'])
  // A player who starts anew elsewhere and then in the room has crossed nothing.
  startGeofences(places.lobby)
  startGeofences(places.vesper)
  expect(room()).toBe('vesper')
  expect(crossings).toHaveLength(2)
  stop()
  for (const stopOther of stopOthers) {
    stopOther()
  }
  probeGeofences(places.lobby, still)
  probeGeofences(places.vesper, still)
  expect(crossings).toHaveLength(2)
})
