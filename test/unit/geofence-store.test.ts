import type {GeofenceCrossing} from '../../src/lib/gallery/geofences.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, test} from 'bun:test'

import {onGeofenceEnter, probeGeofences, startGeofences, useGeofences} from '../../src/lib/gallery/geofences.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const still: Vec3 = [0, 0, 0]
/** where a standing player’s place is in the Lobby, on the plane of its wall to the Vesper, in the Vesper, in the Forge and its vestibule, on the Bastion’s run north behind the Forge, on its approach to the vestibule, over the Lodge, whose fence reaches up through its roof, and outside of the world */
const places = {
  lobby: [0, 0.9, 0],
  wall: [-8, 0.9, 0],
  vesper: [-14, 0.9, 0],
  forge: [-14, 0.9, -24],
  vestibule: [-14, 0.9, -35],
  run: [-22.3, 0.9, -28],
  approach: [-22.3, 0.9, -34],
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
  startGeofences(places.approach)
  expect(fences()).toEqual(['bastion', 'lodge', 'imminent_forge'])
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
  // A fence that is no room’s never is the room: on the approach, the player is in the Bastion.
  probeGeofences(places.approach, still)
  expect(fences()).toEqual(['bastion', 'lodge', 'imminent_forge'])
  expect(room()).toBe('bastion')
  probeGeofences(places.vestibule, still)
  expect(room()).toBe('forge')
  expect(rooms).toEqual(['vesper', 'bastion', 'forge'])
  stop()
})
test('whoever hears of a crossing already finds the player in its room', () => {
  startGeofences(places.run)
  const heard: Array<string> = []
  const stop = useGeofences.subscribe(() => heard.push(room()))
  probeGeofences(places.vestibule, still)
  expect(heard).toEqual(['forge'])
  stop()
})
test('a fence’s enter listener hears every crossing into it, but neither a start in it nor staying in it', () => {
  const crossings: Array<GeofenceCrossing> = []
  const stop = onGeofenceEnter('imminent_forge', crossing => crossings.push(crossing))
  startGeofences(places.approach)
  probeGeofences(places.approach, still)
  expect(crossings).toEqual([])
  // Back down the run and up again
  probeGeofences(places.run, [0, 0, 3])
  expect(crossings).toEqual([])
  probeGeofences(places.approach, [0, 0, -3])
  probeGeofences([-22.3, 0.9, -34.5], [0, 0, -3])
  expect(crossings).toEqual([{
    position: places.approach,
    velocity: [0, 0, -3],
  }])
  // Through the vestibule into the Forge and out again onto the approach
  probeGeofences(places.vestibule, [3, 0, 0])
  expect(fences()).toEqual(['forge'])
  probeGeofences([-18, 0.9, -35], [-3, 0, 0])
  expect(crossings).toHaveLength(2)
  // A player who starts anew elsewhere and then on the approach has crossed nothing.
  startGeofences(places.lobby)
  startGeofences(places.approach)
  expect(crossings).toHaveLength(2)
  stop()
  probeGeofences(places.run, still)
  probeGeofences(places.approach, still)
  expect(crossings).toHaveLength(2)
})
