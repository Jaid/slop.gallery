import type {MoodFade} from './Mood.ts'

import Mood from './Mood.ts'

/** seconds a room’s mood takes to come and to go as the listener walks in and out: quickly, so its acoustics follow them through the doorway, and alike both ways, so the moods of two rooms cross over evenly */
export const roomMoodFade: MoodFade = {
  in: 0.5,
  out: 0.5,
}

/** A mood that holds while the listener is in a room that names it, beneath whatever is cast over the world, made of what the room contributes, like its acoustics, a `reverberation` of what it is built of. */
export default abstract class RoomMood extends Mood {
  override readonly fade = roomMoodFade
}
