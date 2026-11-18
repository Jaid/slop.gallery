import type {Mood, MoodId} from '../index.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {moods} from '../index.ts'

const moodSchema = optis({
  defaults: {
    mood: '',
  },
  normalizations: {
    mood(value: unknown): MoodId | '' {
      return typeof value === 'string' && Object.hasOwn(moods, value) ? value as MoodId : ''
    },
  },
})

/** Read the `?mood`, the id of a mood that holds all the time as if its prop were held, for looking at it without grabbing anything; empty for none or an id no mood has. */
export function readMood(input: URL | string = typeof location === 'undefined' ? '' : location.href): MoodId | '' {
  return readPermalink(input, {schema: moodSchema}).mood
}

const forcedMoodId = readMood()

/** the mood held all the time as if its prop were held: the one `?mood` names, read once at startup, until the `cast_mood` WebMCP tool holds another one or none */
export const forcedMood: {current: Mood | null} = {current: forcedMoodId ? moods[forcedMoodId] : null}
