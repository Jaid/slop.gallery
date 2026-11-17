import type World from './base/World.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {resolveArrival} from './arrival.ts'

export type WorldReachMode = 'all' | 'neighbors' | 'room'
const schema = optis({
  defaults: {world_reach: 'all'},
  normalizations: {
    world_reach(value: unknown): WorldReachMode {
      return value === 'room' || value === 'neighbors' ? value : 'all'
    },
  },
})

/** Read the fixed mounting scope. Unknown values leave the whole world enabled. */
export function readWorldReach(input: URL | string = typeof location === 'undefined' ? '' : location.href): WorldReachMode {
  return readPermalink(input, {schema}).world_reach
}

/** Admission to the scene, not visibility: moving or teleporting never expands this startup selection. The full logical world remains available for bookmarks and deterministic artwork assignment. */
export default class WorldReach {
  readonly anchor: string
  readonly mode: WorldReachMode
  readonly rooms: ReadonlySet<string>

  constructor(world: World, input?: URL | string) {
    this.mode = readWorldReach(input)
    const arrival = resolveArrival(world, input)
    const [x, y, z] = arrival.pose.position
    // A low development camera can fly with its body below the floor and outside every fence while its eyes are still in the room.
    const anchor = world.roomAt(arrival.pose.position) ?? (arrival.flying ? world.roomAt([x, y + 1.6, z]) : undefined)
    this.anchor = anchor?.id ?? world.defaultRoom
    this.rooms = new Set(this.mode === 'all' ? world.rooms.map(room => room.id) : [this.anchor, ...this.mode === 'neighbors' ? world.neighborRooms(this.anchor) : []])
  }

  includes(room: string) {
    return this.rooms.has(room)
  }
}
