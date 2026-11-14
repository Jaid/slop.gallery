import type {Portrait, Vec3} from './types.ts'

import world from '#src/worlds/current.ts'

import portraitObjects from './portraitObjects.ts'

/** Where a work is in the world right now, in meters: at its body while it has one, which a loose work still tumbles with, and where the store last put it otherwise. */
export function portraitPosition(portrait: Pick<Portrait, 'id' | 'position'>): Vec3 {
  const physical = portraitObjects.get(portrait.id)?.body.translation()
  return physical ? [physical.x, physical.y, physical.z] : portrait.position
}

/**
 * The room a work is currently in: a hung work belongs to the room whose wall it hangs on, whose fence its face may already stick out of, and a loose work to the room whose fence holds where it lies.
 * Undefined between fences, like in a passage between two rooms. `position` left out is looked up as {@link portraitPosition} does.
 */
export function portraitRoom(portrait: Pick<Portrait, 'hung' | 'id' | 'position' | 'wallId'>, position: Vec3 = portraitPosition(portrait)) {
  if (portrait.hung && portrait.wallId) {
    const wall = world.walls.find(candidate => candidate.id === portrait.wallId)
    const room = wall && world.roomById(wall.room)
    if (room) {
      return room
    }
  }
  return world.roomAt(position)
}

/** What the work’s current room, see {@link portraitRoom}, is called, “Between rooms” outside of every fence. */
export function portraitRoomTitle(portrait: Pick<Portrait, 'hung' | 'id' | 'position' | 'wallId'>, position?: Vec3) {
  return portraitRoom(portrait, position)?.title ?? 'Between rooms'
}
