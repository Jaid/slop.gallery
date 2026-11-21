import optis from 'optis'
import readPermalink from 'read-permalink'

import isFlagOn from '#src/lib/permalinkFlag.ts'

/** `true` for full volume, an integer percentage for that volume, `false` for muted */
export type AudioFlag = boolean | number

const audioSchema = optis({
  defaults: {
    audio: false,
  },
  normalizations: {
    audio(value: unknown): AudioFlag {
      if (isFlagOn(value)) {
        return true
      }
      const text = typeof value === 'number' ? String(value) : value
      if (typeof text === 'string' && /^\d{1,3}$/.test(text)) {
        const percentage = Number(text)
        if (percentage <= 100) {
          return percentage || false
        }
      }
      return false
    },
  },
})

/** Read the `?audio` flag: a bare `?audio` or `true` plays at full volume, an integer percentage from 1 to 100 at that volume, and `false` or `0`, like anything else, starts muted. */
export function readAudio(input: URL | string = typeof location === 'undefined' ? '' : location.href): AudioFlag {
  return readPermalink(input, {schema: audioSchema}).audio
}

/** Whether the page starts with audio on, or `undefined` without `?audio`, so the player’s last switch decides. */
export function readAudioOverride(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean | undefined {
  const url = new URL(input, 'http://localhost/')
  if (!url.searchParams.has('audio')) {
    return
  }
  return readAudio(input) !== false
}

/** The factor on every sound’s level: the `?audio` percentage, or full volume otherwise, so unmuting a muted start plays at full volume. */
export function readAudioVolume(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  const audio = readAudio(input)
  return typeof audio === 'number' ? audio / 100 : 1
}

/** whether this page was opened with audio on or off through `?audio`, read once at startup */
export const audioOverride = readAudioOverride()

/** the factor on every sound’s level, read once at startup */
export const audioVolume = readAudioVolume()
