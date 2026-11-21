import optis from 'optis'
import readPermalink from 'read-permalink'

import isFlagOn from '#src/lib/permalinkFlag.ts'

export const intro = {
  id: '__intro',
  title: 'Welcome to Slop Gallery',
  description: 'Where the art is questionable and the insurance is imaginary. Take a walk, touch the paintings and bring a little of your own chaos. The curator has already left.',
}

const introNarrationSchema = optis({
  defaults: {
    intro_narration: false,
  },
  normalizations: {
    intro_narration(value: unknown) {
      return isFlagOn(value) || value === '1'
    },
  },
})

/** Read the `?intro_narration` flag; the welcome narration only plays with a bare `?intro_narration`, `true` or `1`. */
export function readIntroNarration(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: introNarrationSchema}).intro_narration
}
