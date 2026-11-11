import type {MoodId} from '../index.ts'

import {steeredOrb} from '#src/lib/gallery/alchemy/steering.ts'

import {moods} from '../index.ts'

/** The registered prop’s own mood, or, while held in the Forge, that of the orb it steers the alchemy machine to. Leave `room` out for inspection, which only shows a prop’s own mood. */
export function propMood(id: string | null, props: ReadonlyMap<string, {mood?: MoodId}>, room?: string) {
  const prop = id ? props.get(id) : undefined
  if (!id || !prop) {
    return
  }
  const mood = prop.mood ?? (room === 'forge' ? steeredOrb(id)?.mood : undefined)
  return mood ? moods[mood] : undefined
}
