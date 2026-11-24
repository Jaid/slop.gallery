import type {StoneId} from './stoneIds.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {isStoneId} from './stoneIds.ts'

const stoneSchema = optis({
  defaults: {stone: ''},
  normalizations: {
    stone(value: unknown): StoneId | '' {
      return isStoneId(value) ? value : ''
    },
  },
})

/** Read the `?stone`, the id of the stone the Salon’s sculpture and its socket are cut from whatever the seed rolls, for looking at any of them in any game; empty for none or an id no stone has. */
export function readStone(input: URL | string = typeof location === 'undefined' ? '' : location.href): StoneId | '' {
  return readPermalink(input, {schema: stoneSchema}).stone
}

/** the id of the stone `?stone` cuts the Salon’s sculpture and socket from, read once at startup, or empty */
export const forcedStone = readStone()
