import type {MoodId} from '../index.ts'

/** what a prop says about the mood it casts */
export type MoodCastingProp = {
  /** the id of the mood that comes over the world while the player holds the prop, if any */
  mood?: MoodId
  /** the id of the room the mood only comes over the world in, if it only comes in one */
  moodRoom?: string
}

/**
 * The id of the mood a prop casts while the player is in `room`, or undefined where it casts none there.
 * A prop that names no room casts in every room, like an orb; one that names a room casts only there, like a magic item, which belongs to its orb only in the Forge.
 */
export function castMoodId(prop: MoodCastingProp | undefined, room: string): MoodId | undefined {
  return prop?.mood && (!prop.moodRoom || prop.moodRoom === room) ? prop.mood : undefined
}
