import type {Mood} from '#src/moods/index.ts'

import {moods} from '#src/moods/index.ts'
import {forcedMood} from '#src/moods/lib/forcedMood.ts'
import {moodFade} from '#src/moods/lib/MoodMixer.ts'

export type MoodCastInput = {
  /** the id of the mood to hold, like `paint`, or null to hold none anymore */
  mood: string | null
}
export type MoodCast = {
  /** seconds it takes to come over the world and to leave it again */
  fade?: {
    in: number
    out: number
  }
  /** the id of the mood held now, or null with none */
  mood: string | null
  title?: string
}

/** Holds `mood` from now on as if its prop were held, like `?mood` does from the start, or lets go of the mood held with null; see the `cast_mood` tool. */
export default function castMood({mood: id}: MoodCastInput): MoodCast {
  if (id === null) {
    forcedMood.current = null
    return {mood: null}
  }
  if (!Object.hasOwn(moods, id)) {
    throw new Error(`There is no mood “${id}”. Moods: ${Object.keys(moods).join(', ')}.`)
  }
  const mood: Mood = moods[id as keyof typeof moods]
  forcedMood.current = mood
  return {
    mood: id,
    title: mood.title,
    fade: mood.fade ?? moodFade,
  }
}
