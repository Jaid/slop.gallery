import type {GeofenceCrossing} from '../../src/lib/gallery/geofences.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, test} from 'bun:test'

import {onGeofenceEnter, onRoomEnter, probeGeofences, startGeofences, useGeofences} from '../../src/lib/gallery/geofences.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const still: Vec3 = [0, 0, 0]
/** where a standing player’s place is in the Lobby, on the plane of its wall to the Vesper, in the Vesper, in the Forge and its vestibule, on the Bastion’s run north behind the Forge, in its connecting tunnel in front of the doorway into the knight’s alley, in that alley, and outside of the world */
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
afterEach(() => {
  useGeofences.setState(useGeofences.getInitialState(), true)
  useGallery.setState({room: slopGallery.defaultRoom})
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
  expect(fences()).toEqual(['bastion', 'knight_alley'])
  expect(room()).toBe('bastion')
  startGeofences(places.wall)
  expect(fences()).toEqual(['lobby', 'vesper'])
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
  probeGeofences([1, 0.9, -3], [3, 0, -3])
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
      fences: ['lobby', 'vesper'],
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
  expect(fences()).toEqual(['bastion', 'knight_alley'])
  expect(room()).toBe('bastion')
  probeGeofences(places.vestibule, still)
  expect(room()).toBe('forge')
  expect(rooms).toEqual(['vesper', 'bastion', 'forge'])
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
    fences: ['knight_alley'],
  })
  expect(room()).toBe('vesper')
  useGeofences.setState({
    crossing: null,
    fences: ['knight_alley'],
  })
  expect(room()).toBe('lobby')
})
test('whoever hears of a crossing already finds the player in its room', () => {
  startGeofences(places.run)
  const heard: Array<string> = []
  const stop = useGeofences.subscribe(() => heard.push(room()))
  probeGeofences(places.vestibule, still)
  expect(heard).toEqual(['forge'])
  stop()
})
test('a fence’s enter listener hears every crossing into it, a room’s or not, but neither a start in it nor staying in it', () => {
  const crossings: Array<GeofenceCrossing> = []
  const stop = onGeofenceEnter('knight_alley', crossing => crossings.push(crossing))
  startGeofences(places.alley)
  probeGeofences(places.alley, still)
  expect(crossings).toEqual([])
  // Back out into the connecting tunnel and in again, all of it in the Bastion
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
  expect(fences()).toEqual(['lobby', 'vesper'])
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
