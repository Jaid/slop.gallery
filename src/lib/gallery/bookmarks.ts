import type {CameraBookmark, SpawnBookmark, Vec3} from './types.ts'

import {Euler, Quaternion} from 'three/webgpu'

import {bookmarkFeet, resolveArrival} from '#src/worlds/arrival.ts'
import world from '#src/worlds/current.ts'

import {galleryEvents, notify} from './actions.ts'
import {flyMode} from './flyMode.ts'
import {playerSession} from './PlayerSession.ts'
import {readRoom, readSpawn} from './spawn.ts'

/** key that teleports the player to the next bookmark with `?development`, or to the previous one with Shift */
export const bookmarkKey = 'KeyT'

/** how close the player’s feet must be to a bookmark to count as standing in it, in meters */
export const bookmarkRadius = 1

/** The spawn bookmark `?spawn` names, `null` without `?spawn` and `undefined` when this world has no spawn bookmark with that ID. */
export function findSpawnBookmark(input?: URL | string, list: ReadonlyArray<SpawnBookmark> = world.spawnBookmarks()): SpawnBookmark | null | undefined {
  const id = readSpawn(input)
  return id ? list.find(bookmark => bookmark.id === id) : null
}

/** The camera bookmark `?spawn` names, `null` without `?spawn` and `undefined` when this world has no camera bookmark with that ID. */
export function findCameraBookmark(input?: URL | string, list: ReadonlyArray<CameraBookmark> = world.cameraBookmarks()): CameraBookmark | null | undefined {
  const id = readSpawn(input)
  return id ? list.find(bookmark => bookmark.id === id) : null
}

/** The default spawn in world meters of the room `?room` names, `null` without `?room` and `undefined` when this world has no room with that ID. */
export function findRoomSpawn(input?: URL | string): SpawnBookmark | null | undefined {
  const id = readRoom(input)
  if (!id) {
    return null
  }
  const room = world.roomById(id)
  return room && {
    id: room.id,
    ...room.spawn,
  }
}

/** Where the player stands below a camera bookmark: a standing eye height under the camera, but never below the floor unless `flying`. */
export function cameraBookmarkFeet({position}: CameraBookmark, flying = false): Vec3 {
  return bookmarkFeet(world, position, flying)
}

/** Move the player session to the `?spawn` bookmark; for a camera bookmark, below it, and with `?development` flying with its eyes at the bookmark. A camera bookmark wins over a spawn bookmark with the same ID, which T still reaches. Without `?spawn`, `?room` starts at the default spawn of that room. */
export function applySpawnBookmark() {
  const arrival = resolveArrival(world)
  flyMode.active ||= arrival.flying
  playerSession.restore(arrival.pose)
  if (arrival.error) {
    notify(arrival.error)
  }
}

/** Pick the bookmark to teleport to from feet position `position`: the one after (or with `backward`, before) the bookmark the player stands in, or else the closest one. */
export function nextBookmark(position: Vec3, list: ReadonlyArray<SpawnBookmark>, backward = false): number | null {
  if (!list.length) {
    return null
  }
  const distances = list.map(bookmark => Math.hypot(bookmark.position[0] - position[0], bookmark.position[1] - position[1], bookmark.position[2] - position[2]))
  const closest = distances.indexOf(Math.min(...distances))
  // Cycling through the list from the current bookmark reaches every one, while “closest other” could bounce between two neighbors forever.
  return distances[closest] <= bookmarkRadius ? (closest + (backward ? list.length - 1 : 1)) % list.length : closest
}

/** Teleport the player to the next (or with `backward`, previous) of the current world’s spawn bookmarks, see `nextBookmark`. */
export function teleportToNextBookmark(backward = false) {
  const spawnBookmarks = world.spawnBookmarks()
  const index = nextBookmark(playerSession.snapshot().position, spawnBookmarks, backward)
  if (index === null) {
    notify(`${world.title} has no spawn bookmarks.`)
    return
  }
  const {id, position, yaw, pitch} = spawnBookmarks[index]
  const rotation = new Quaternion
  galleryEvents.dispatchEvent(new CustomEvent('teleport', {
    detail: {
      feet: true,
      position: [...position],
      rotation: rotation.setFromEuler(new Euler(pitch, yaw, 0, 'YXZ')).toArray(),
    },
  }))
  notify(`Bookmark ${index + 1} of ${spawnBookmarks.length}: ${id}`)
}
