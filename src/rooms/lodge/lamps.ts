import type {Lamp} from '../base/Room.ts'
import type {Vec3} from 'math'

import fire from '#src/lib/gallery/fireplace/config.ts'

/** A point of the fire, in the fireplace turned by 180° to face the room, in the room’s frame. */
const fromFire = ([x, y, z]: Vec3): Vec3 => [-(fire.position[0] + x), fire.position[1] + y, -(fire.position[2] + z)]

export default {
  // High above the front log, flickering with the flames around an average of 90%.
  fire: {
    position: fromFire(fire.light.position),
    strength: 68,
    tint: '#ffb45b',
    range: 12,
    decay: 1.5,
    shadow: 'heavy',
  },
} satisfies Record<string, Lamp>
