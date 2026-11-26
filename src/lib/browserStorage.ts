import {currentWorldInfo} from '#src/worlds/index.ts'

/**
 * Everything the browser keeps between visits. Nothing else is saved: a reload starts the game over in the environment of the same seed, until Reroll seed forgets it.
 */
const keys = {
  /** the OpenRouter API key */
  apiKey: 'slop-gallery-key',
  /** whether audio is on, once the player switched it */
  audio: 'slop-gallery-audio',
  /** the graphics quality the player last picked in the menu, which the next page load goes by */
  graphics: 'slop-gallery-graphics',
  /** the environment seed of the current world’s game */
  seed: `${currentWorldInfo.storageKey}-seed`,
} as const

export type StoredValue = keyof typeof keys

/** The stored value, or `null` if there is none or storage is blocked. */
export function readStored(name: StoredValue) {
  try {
    return localStorage.getItem(keys[name])
  } catch {
    return null
  }
}

/** Stores the value, or forgets it for `null`. Returns whether that worked, which blocked storage keeps from happening. */
export function writeStored(name: StoredValue, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(keys[name])
    } else {
      localStorage.setItem(keys[name], value)
    }
    return true
  } catch {
    return false
  }
}
