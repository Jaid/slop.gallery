import type {PlayerPose, Vec3} from '#src/lib/gallery/types.ts'
import type World from './base/World.ts'

import {readDevelopmentMode} from '#src/lib/developmentMode.ts'
import {readRoom, readSpawn} from '#src/lib/gallery/spawn.ts'

/** Camera bookmarks normally stand no lower than the floor; development mode flies with its eyes at the exact bookmark. */
export function bookmarkFeet(world: Pick<World, 'floorHeight'>, position: Vec3, flying = false): Vec3 {
  const feet = position[1] - 1.6
  return [position[0], flying ? feet : Math.max(world.floorHeight(position) + 0.04, feet), position[2]]
}

/** One startup resolution for both the player and mounting scope. A supplied but unknown bookmark does not fall through to ?room, matching the player’s existing behavior. */
export function resolveArrival(world: World, input?: URL | string): {
  error?: string
  flying: boolean
  pose: PlayerPose
} {
  const spawn = readSpawn(input)
  const room = readRoom(input)
  let pose = world.spawn
  let flying = false
  let error: string | undefined
  if (spawn) {
    const camera = world.cameraBookmarks().find(entry => entry.id === spawn)
    const bookmark = world.spawnBookmarks().find(entry => entry.id === spawn)
    if (camera) {
      flying = readDevelopmentMode(input)
      pose = {
        position: bookmarkFeet(world, camera.position, flying),
        ...camera.aim,
      }
    } else if (bookmark) {
      pose = bookmark
    } else {
      error = `${world.title} has no bookmark “${spawn}”.`
    }
  } else if (room) {
    const placed = world.roomById(room)
    if (placed) {
      pose = placed.spawn
    } else {
      error = `${world.title} has no room “${room}”.`
    }
  }
  // PlayerSession rejects poses outside the world too. Keep scope anchored to the same fallback.
  return {
    pose: world.contains(pose.position) ? pose : world.spawn,
    flying,
    error,
  }
}
