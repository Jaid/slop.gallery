import type {Vec3} from '#src/lib/gallery/types.ts'
import type World from './World.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {readDevelopmentMode} from '#src/lib/developmentMode.ts'
import {readRoom, readSpawn} from '#src/lib/gallery/spawn.ts'

/** the fixed startup scope of a world’s mounted objects */
export type WorldReachMode = 'all' | 'neighbors' | 'room'
const schema = optis({
  defaults: {world_reach: 'all'},
  normalizations: {
    world_reach(value: unknown): WorldReachMode {
      return value === 'room' || value === 'neighbors' ? value : 'all'
    },
  },
})

/** Read `?world_reach`: unknown or missing values keep the whole world. */
export function readWorldReach(input: URL | string = typeof location === 'undefined' ? '' : location.href): WorldReachMode {
  return readPermalink(input, {schema}).world_reach
}

/** The feet below a camera bookmark, held above the floor unless development mode starts the player flying. */
export function cameraFeet(world: Pick<World, 'floorHeight'>, position: Vec3, flying = false): Vec3 {
  return [position[0], flying ? position[1] - 1.6 : Math.max(world.floorHeight(position) + 0.04, position[1] - 1.6), position[2]]
}

/** The startup position used by the session: camera bookmarks win over spawn bookmarks, then `?room`, then the default spawn. An unknown bookmark ignores `?room`, just like applySpawnBookmark. */
export function spawnPosition(world: Pick<World, 'cameraBookmarks' | 'contains' | 'floorHeight' | 'roomById' | 'spawn' | 'spawnBookmarks'>, input: URL | string = typeof location === 'undefined' ? '' : location.href): Vec3 {
  const id = readSpawn(input)
  const camera = id ? world.cameraBookmarks().find(bookmark => bookmark.id === id) : undefined
  const position = (id ? (camera ? cameraFeet(world, camera.position, readDevelopmentMode(input)) : world.spawnBookmarks().find(bookmark => bookmark.id === id)?.position) : world.roomById(readRoom(input))?.spawn.position) ?? world.spawn.position
  // PlayerSession.restore rejects positions outside the world too.
  return world.contains(position) ? position : world.spawn.position
}

/** A fixed set of rooms, resolved once from the startup pose, never expanded by walking, teleporting or a capture’s camera track. Metadata remains available for navigation and bookmarks, but only these rooms may create scene objects. */
export default class WorldReach {
  readonly mode: WorldReachMode
  readonly room: string
  readonly rooms: ReadonlySet<string>

  constructor(world: Pick<World, 'cameraBookmarks' | 'contains' | 'defaultRoom' | 'floorHeight' | 'neighborRooms' | 'roomAt' | 'roomById' | 'rooms' | 'spawn' | 'spawnBookmarks'>, input: URL | string = typeof location === 'undefined' ? '' : location.href) {
    this.mode = readWorldReach(input)
    // Camera bookmarks may lie outside every fence. Keep the default room in that case rather than mounting an empty world.
    this.room = world.roomAt(spawnPosition(world, input))?.id ?? world.defaultRoom
    this.rooms = new Set(this.mode === 'all' ? world.rooms.map(room => room.id) : [this.room, ...this.mode === 'neighbors' ? world.neighborRooms(this.room) : []])
  }

  includes(room: string) {
    return this.rooms.has(room)
  }
}
