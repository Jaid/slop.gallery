import type {Vec3} from 'math'

/** where an ambience emitter sounds, as whoever places one gives it */
export type EmitterPlacement = {
  /** the id it goes by where it sounds, unique in the world, like the global id of a room’s ambience entry, `lobby-fountain` */
  id: string
  /** where it sounds from, in world meters */
  position: Vec3
  /** the ids of the rooms the listener must be in to hear it; everywhere if left out */
  rooms?: ReadonlyArray<string>
}
