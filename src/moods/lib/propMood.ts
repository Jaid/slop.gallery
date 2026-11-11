import type Mood from '../base/Mood.ts'
import type {MoodId} from '../index.ts'

import {moods} from '../index.ts'

/** what a prop tells about the mood it casts while the player holds it or views it with V */
export type MoodCaster = {
  /** the id of the mood that comes over the world while the player holds the prop */
  mood?: MoodId
  /** the id of the only room the mood comes over the world in, while the player is in it, like the Forge for the curios steering its alchemy machine; in every room if left out */
  moodRoom?: string
}

/** The mood a prop casts over the world while the player, in `room`, holds it or views it with V: its own, unless it only casts it in another room; none for no prop or a prop without one. */
export function propMood(prop: MoodCaster | undefined, room: string): Mood | undefined {
  if (!prop?.mood || prop.moodRoom !== undefined && prop.moodRoom !== room) {
    return
  }
  return moods[prop.mood]
}
