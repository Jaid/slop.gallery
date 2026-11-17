import type {CameraBookmark, SpawnBookmark, Vec3} from './types.ts'

import {Euler, Quaternion} from 'three/webgpu'

import world from '#src/worlds/current.ts'

import {galleryEvents, notify} from './actions.ts'
import {flyMode} from './flyMode.ts'
import {playerSession} from './PlayerSession.ts'
import {findNamedBookmark, readRoom} from './spawn.ts'

/** key that teleports the player to the next bookmark with `?development`, or to the previous one with Shift */
export const bookmarkKey = 'KeyT'

/** how close the player’s feet must be to a bookmark to count as standing in it, in meters */
export const bookmarkRadius = 1

/** The spawn bookmark `?spawn` names, `null` without `?spawn` and `undefined` when this world has no spawn bookmark with that ID. */
export function findSpawnBookmark(input?: URL | string, list: ReadonlyArray<SpawnBookmark> = world.spawnBookmarks()): SpawnBookmark | null | undefined {
  return findNamedBookmark(list, input)
}

/** The camera bookmark `?spawn` names, `null` without `?spawn` and `undefined` when this world has no camera bookmark with that ID. */
export function findCameraBookmark(input?: URL | string, list: ReadonlyArray<CameraBookmark> = world.cameraBookmarks()): CameraBookmark | null | undefined {
  return findNamedBookmark(list, input)
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
export function cameraBookmarkFeet(bookmark: CameraBookmark, flying = false): Vec3 {
  return world.cameraBookmarkFeet(bookmark, flying)
}

/** Move the player session to where the URL starts in the world, see `World.start`, which `?world_reach` also reaches out from: the `?spawn` bookmark, for a camera bookmark below it, and with `?development` flying with its eyes at the bookmark, or else the default spawn of the `?room`. */
export function applySpawnBookmark() {
  const {flying, pose, unknown} = world.start()
  flyMode.active ||= flying
  playerSession.restore(pose)
  if (unknown) {
    notify(`${world.title} has no ${unknown.parameter === 'spawn' ? 'bookmark' : 'room'} “${unknown.id}”.`)
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

/** Teleport the player to the next (or with `backward`, previous) of the current world’s spawn bookmarks in its reach, see `nextBookmark`; the others would only drop the player into the void. */
export function teleportToNextBookmark(backward = false) {
  const spawnBookmarks = world.spawnBookmarks().filter(({position}) => world.reach.covers(world.roomAt(position)?.id))
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
