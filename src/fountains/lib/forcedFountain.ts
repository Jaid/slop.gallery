import type {FountainId} from '../index.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {fountains} from '../index.ts'

const fountainSchema = optis({
  defaults: {
    fountain: '',
  },
  normalizations: {
    fountain(value: unknown): FountainId | '' {
      return typeof value === 'string' && Object.hasOwn(fountains, value) ? value as FountainId : ''
    },
  },
})

/** Read the `?fountain`, the id of a fountain that stands wherever the seed rolls one, like in the Lobby, for looking at any of them in any game; empty for none or an id no fountain has. */
export function readFountain(input: URL | string = typeof location === 'undefined' ? '' : location.href): FountainId | '' {
  return readPermalink(input, {schema: fountainSchema}).fountain
}

/** the id of the fountain `?fountain` stands wherever the seed rolls one, read once at startup, or empty */
export const forcedFountain = readFountain()
