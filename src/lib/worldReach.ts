import type World from '#src/worlds/base/World.ts'
import type {Vec3} from './gallery/types.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import world from '#src/worlds/current.ts'

import {playerSession} from './gallery/PlayerSession.ts'

/** every reach `?world_reach` takes, the default last */
export const worldReaches = ['room', 'neighbors', 'all'] as const
/** how much of the world loads: only the room the spawn position belongs to, that room and its neighbor rooms, or every room */
export type WorldReach = typeof worldReaches[number]

const worldReachSchema = optis({
  defaults: {
    world_reach: 'all',
  },
  normalizations: {
    world_reach(value: unknown): WorldReach {
      return worldReaches.find(reach => reach === value) ?? 'all'
    },
  },
})

/** Read the `?world_reach`: `room` loads only the spawn position’s room, `neighbors` also its neighbor rooms and `all`, the default, loads the whole world; anything else is `all`. Rooms out of reach never mount, so their openings look out on the void, which cuts the loading of captures that only show one room down to that room. It limits the loading, not the world: walking through an opening into a room out of reach leaves what loaded behind. */
export function readWorldReach(input: URL | string = typeof location === 'undefined' ? '' : location.href): WorldReach {
  return readPermalink(input, {schema: worldReachSchema}).world_reach
}

/** the reach this page loads its world with, read once at startup */
export const worldReach = readWorldReach()

/**
 * The ids of the rooms within the reach around the spawn position in the world, or null for every room: for `all`, and for a spawn outside of every room, where there is no room to limit the loading to.
 * The neighbors of a room are whatever the world names as such, for the gallery the rooms its relations keep on while the player is inside it.
 */
export function roomsWithinReach(reach: WorldReach, target: Pick<World, 'neighborRooms' | 'roomAt'>, position: Vec3): ReadonlySet<string> | null {
  if (reach === 'all') {
    return null
  }
  const spawn = target.roomAt(position)
  if (!spawn) {
    return null
  }
  return reach === 'room' ? new Set([spawn.id]) : new Set([spawn.id, ...target.neighborRooms(spawn.id)])
}

let current: ReadonlySet<string> | null = null
let resolved = false

/**
 * The ids of the rooms this page loads, within {@link worldReach} of the spawn position, or null for every room, see {@link roomsWithinReach}.
 * Resolved on first use and kept for the page: the scene first mounts after `main.tsx` has put the session at its spawn, while the player hasn’t moved yet, and what never mounts cannot mount later either.
 */
export function reachedRooms(): ReadonlySet<string> | null {
  if (!resolved) {
    current = roomsWithinReach(worldReach, world, playerSession.snapshot().position)
    resolved = true
  }
  return current
}

/** Whether the room with the id loads on this page, see {@link reachedRooms}. */
export function isRoomReached(room: string): boolean {
  const reached = reachedRooms()
  return reached === null || reached.has(room)
}
