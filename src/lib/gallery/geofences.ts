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
 * The fences of the current world the player’s place (`bodyPose.place`) is in. The scene probes the world’s fences once per frame, see {@link probeGeofences}, and everything that depends on where the player is goes by what it finds: the room the player is in, whatever a fence triggers, see {@link onGeofenceEnter}, and the telemetry’s geofence events.
 * It only changes as the player’s place crosses a fence, so a subscription sees every crossing once, with the fences left and entered between its two states.
 */
export const useGeofences = create<GeofenceState>(() => ({
  crossing: null,
  fences: [],
}))

// The room the player is in is the first room whose fence holds the player’s place. Outside of every room’s fence, it stays the room entered last, like in a passage between two rooms, but a player starting there starts in the world’s default room.
// Subscribed before anything else can, so whoever hears of a crossing already finds the player in its room.
useGeofences.subscribe(({crossing, fences}) => {
  const room = fences.find(id => world.roomById(id)) ?? (crossing ? undefined : world.defaultRoom)
  if (room !== undefined && room !== useGallery.getState().room) {
    useGallery.setState({room})
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

/** Calls the listener whenever the player’s place crosses into the fence with the id, with how it did, though not for a player who starts in it; returns the unsubscription. */
export function onGeofenceEnter(id: string, listener: (crossing: GeofenceCrossing) => void) {
  return useGeofences.subscribe(({crossing, fences}, previous) => {
    if (crossing && fences.includes(id) && !previous.fences.includes(id)) {
      listener(crossing)
    }
  })
}
