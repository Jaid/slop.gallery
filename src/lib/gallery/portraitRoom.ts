import type World from '#src/worlds/base/World.ts'
import type {Portrait} from './types.ts'

import {Vector3} from 'three/webgpu'

import portraitObjects from './portraitObjects.ts'

/** The room a work is in now, not where it first hung. A hung work belongs to its wall (its center may lie just outside the room’s fence); a loose or fusing work follows its visible group, which can move independently of its body and stored position. */
export default function portraitRoom(world: World, portrait: Portrait) {
  if (portrait.hung && !portrait.fusing && portrait.wallId) {
    const wall = world.placement.wall(portrait.wallId)
    const room = wall && world.roomById(wall.room)
    if (room) {
      return room
    }
  }
  const object = portraitObjects.get(portrait.id)
  const position = object?.group.getWorldPosition(new Vector3)
  return world.roomAt(position ? [position.x, position.y, position.z] : portrait.position)
}
