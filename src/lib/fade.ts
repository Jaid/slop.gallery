import optis from 'optis'
import readPermalink, {parseBoolean} from 'read-permalink'

const fadeSchema = optis({
  defaults: {
    fade: true,
  },
  normalizations: {
    fade(value: unknown) {
      try {
        return parseBoolean(value)
      } catch {
        return true
      }
    },
  },
})

/** Read the `?fade` flag; only an explicit `false` or `0` turns every fade of the moods (their color filters, ambiences and transformers) and of the ambience emitters into a hard cut, so captures taken right after the camera jumped from room to room show the new room as it is. */
export function readFade(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: fadeSchema}).fade
}

/** whether moods and ambience emitters fade in and out instead of cutting, read once at startup */
export const isFading = readFade()
