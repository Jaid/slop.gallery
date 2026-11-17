import type World from './World.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

/** how much of a world mounts around the room the player starts in, from least to most */
export const worldReachModes = ['room', 'neighbors', 'all'] as const
/** how much of a world mounts: only the start room, the start room and its neighbors, or every room */
export type WorldReachMode = typeof worldReachModes[number]

const worldReachSchema = optis({
  defaults: {
    world_reach: 'all',
  },
  normalizations: {
    world_reach(value: unknown): WorldReachMode {
      return worldReachModes.find(mode => mode === value) ?? 'all'
    },
  },
})

/** Read the `?world_reach`: `room`, `neighbors` or `all`, the default, which anything else is too. */
export function readWorldReach(input: URL | string = typeof location === 'undefined' ? '' : location.href): WorldReachMode {
  return readPermalink(input, {schema: worldReachSchema}).world_reach
}

/**
 * The rooms of a world that mount, out of every room it has: with `room`, the one the player starts in, with `neighbors`, that one and its neighbors as the world names them, and with `all` every room.
 * Everything of a room out of reach stays out of the scene: its geometry, its lamps, its works and its props. Its openings show nothing but the void, and nothing hangs on its walls.
 */
export default class WorldReach {
  /** Whether the room is in reach; objects of no room, like a loose work in a passage between rooms, always are. Bound, so it can be handed on as it is. */
  readonly covers = (room: string | undefined) => room === undefined || this.included.has(room)
  /** whether rooms are left out, which `room` and `neighbors` don’t always do: a world of one room, or a room next to all others, has every room in reach */
  readonly limited: boolean
  /** the ids of the rooms in reach, in the world’s order */
  readonly rooms: ReadonlyArray<string>

  private readonly included: ReadonlySet<string>

  constructor(readonly mode: WorldReachMode, readonly origin: string, world: Pick<World, 'neighbors' | 'rooms'>) {
    const wanted = new Set(mode === 'neighbors' ? [origin, ...world.neighbors(origin)] : [origin])
    const all = world.rooms.map(room => room.id)
    if (!all.includes(origin)) {
      throw new Error(`The world reaches out from a room it doesn’t have: “${origin}”.`)
    }
    this.rooms = mode === 'all' ? all : all.filter(room => wanted.has(room))
    this.included = new Set(this.rooms)
    this.limited = this.rooms.length < all.length
  }
}
