import type {Portrait} from './types.ts'

import world from '#src/worlds/current.ts'

import portraitObjects, {portraitPosition} from './portraitObjects.ts'

/**
 * The room of the current world a work is in right now: the room of the wall it hangs on or, loose, the room around it, see `World.portraitRoom`.
 * A loose work between rooms, like in a passage, still counts to the room the world last had it in, where the world keeps track of that for what the player can carry, see `updatePickupRoom`; otherwise it is in no room, undefined.
 */
export default function portraitRoom(portrait: Pick<Portrait, 'hung' | 'id' | 'position' | 'wallId'>) {
  const room = world.portraitRoom(portrait, portraitPosition(portrait))
  if (room) {
    return room
  }
  const last: unknown = portraitObjects.get(portrait.id)?.group.userData.room
  return typeof last === 'string' ? world.roomById(last) : undefined
}
