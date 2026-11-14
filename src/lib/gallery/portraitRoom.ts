import type {Portrait, Vec3} from './types.ts'

import world from '#src/worlds/current.ts'

import {cameraPose} from './actions.ts'
import portraitObjects from './portraitObjects.ts'

/**
 * The title of the room the portrait is currently in: the player’s room while carried, the owner of its wall while hung, or the room holding its live body (or stored position) while loose.
 * Falls back to `'Passage'` when a loose work rests between room fences.
 */
export function portraitRoomTitle(portrait: Pick<Portrait, 'hung' | 'id' | 'position' | 'wallId'>, held: string | null = null, playerRoom?: string) {
  if (held === portrait.id) {
    const carried = (playerRoom ? world.roomById(playerRoom) : undefined) ?? world.roomAt(cameraPose.position)
    return carried?.title ?? 'Passage'
  }
  if (portrait.hung && portrait.wallId !== undefined) {
    const wall = world.placement.wall(portrait.wallId)
    const owner = wall ? world.roomById(wall.room) : undefined
    if (owner) {
      return owner.title
    }
  }
  const physical = portraitObjects.get(portrait.id)?.body.translation()
  const position: Vec3 = physical ? [physical.x, physical.y, physical.z] : portrait.position
  return world.roomAt(position)?.title ?? 'Passage'
}
