import type {Vec3} from './types.ts'

import {create} from 'zustand'

import world from '#src/worlds/current.ts'

import {useGallery} from './store.ts'

/** how the player’s place crossed a fence */
export type GeofenceCrossing = {
  /** where the player’s place was right after it, in world meters */
  position: Vec3
  /** how fast the player moved, in m/s, which tells the direction the fence was crossed in */
  velocity: Vec3
}

type GeofenceState = {
  /** how the player’s place came into the {@link GeofenceState.fences} it is in, or null as long as it is in those it started in */
  crossing: GeofenceCrossing | null
  /** the ids of every fence of the current world that holds the player’s place, in the order the world checks them, so overlapping fences all count; none outside of every fence, like in a passage no room fences */
  fences: ReadonlyArray<string>
}

/**
 * The fences of the current world the player’s place (`bodyPose.place`) is in. The scene probes the world’s fences once per frame, see {@link probeGeofences}, and everything that depends on where the player is goes by what it finds: the room the player is in and the player’s whereabouts, which the world keeps lamps and rooms on by, whatever entering a room or entering or leaving a fence triggers, see {@link onRoomEnter}, {@link onGeofenceEnter} and {@link onGeofenceLeave}, whatever is only there while the player is in a fence, see {@link useGeofence}, and the telemetry’s geofence events.
 * It only changes as the player’s place crosses a fence, so a subscription sees every crossing once, with the fences left and entered between its two states.
 */
export const useGeofences = create<GeofenceState>(() => ({
  crossing: null,
  fences: [],
}))

// The room the player is in is the first room whose fence holds the player’s place, so where the fences of two rooms overlap, the room the world checks first wins, and a fence that is no room’s never counts. Outside of every room’s fence, it stays the room entered last, like in a passage between two rooms, but a player starting there starts in the world’s default room.
// The player’s whereabouts are that room and every fence that is no room’s holding the player’s place, so no other room’s fence counts among them, however far it overlaps the player’s room.
// Subscribed before anything else can, so whoever hears of a crossing already finds the player in its room and its whereabouts.
useGeofences.subscribe(({crossing, fences}) => {
  const {room: last, whereabouts: previous} = useGallery.getState()
  const room = fences.find(id => world.roomById(id)) ?? (crossing ? last : world.defaultRoom)
  const whereabouts = [room, ...fences.filter(id => !world.roomById(id))]
  if (whereabouts.length !== previous.length || whereabouts.some((id, index) => id !== previous[index])) {
    useGallery.setState({
      room,
      whereabouts,
    })
  }
})

/**
 * Puts the player’s place into the fences at the position without crossing any of them, like at the start of a game, in the room of a restored game or at a bookmark, so only actually moving across a fence counts as a crossing.
 */
export function startGeofences(position: Vec3) {
  useGeofences.setState({
    crossing: null,
    fences: world.geofences.getMatches(position),
  })
}

/**
 * Probes every fence of the current world for the player’s place, moving at the velocity in m/s, and, if the fences holding it changed, takes it across them. The scene calls it once per frame, and nothing else probes for the player.
 */
export function probeGeofences(position: Vec3, velocity: Vec3) {
  const fences = world.geofences.getMatches(position)
  const {fences: previous} = useGeofences.getState()
  if (fences.length === previous.length && fences.every((id, index) => id === previous[index])) {
    return
  }
  useGeofences.setState({
    crossing: {
      position: [...position],
      velocity: [...velocity],
    },
    fences,
  })
}

/** Whether the player’s place is in the fence with the id, a room’s or not, for a component to render by: a player who starts in the fence is in it too. */
export function useGeofence(id: string) {
  return useGeofences(({fences}) => fences.includes(id))
}

/**
 * Calls the listener whenever the player’s place crosses into the fence with the id, a room’s or not, with how it did, though not for a player who starts in it; returns the unsubscription.
 * A room’s fence is not the room, which only the first of the rooms holding the player’s place is, see {@link onRoomEnter}.
 */
export function onGeofenceEnter(id: string, listener: (crossing: GeofenceCrossing) => void) {
  return useGeofences.subscribe(({crossing, fences}, previous) => {
    if (crossing && fences.includes(id) && !previous.fences.includes(id)) {
      listener(crossing)
    }
  })
}

/**
 * Calls the listener whenever the player’s place crosses out of the fence with the id, a room’s or not, with how it did; returns the unsubscription.
 * Like entering it, only moving across it counts: a player who starts anew outside of it has not left it.
 */
export function onGeofenceLeave(id: string, listener: (crossing: GeofenceCrossing) => void) {
  return useGeofences.subscribe(({crossing, fences}, previous) => {
    if (crossing && !fences.includes(id) && previous.fences.includes(id)) {
      listener(crossing)
    }
  })
}

/**
 * Calls the listener whenever the player crosses into the room with the id from another room, with how the player crossed its fence; returns the unsubscription.
 * Neither a player who starts in the room counts, nor one who comes back into it from outside of every fence, where it stayed the player’s room, nor one who only enters its fence where a room checked before it holds the player too.
 */
export function onRoomEnter(id: string, listener: (crossing: GeofenceCrossing) => void) {
  return useGallery.subscribe(({room}, previous) => {
    const {crossing} = useGeofences.getState()
    if (crossing && room === id && previous.room !== id) {
      listener(crossing)
    }
  })
}
