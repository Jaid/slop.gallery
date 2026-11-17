import type {SculptureId} from '../index.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {sculptures} from '../index.ts'

const sculptureSchema = optis({
  defaults: {sculpture: ''},
  normalizations: {
    sculpture(value: unknown): SculptureId | '' {
      return typeof value === 'string' && Object.hasOwn(sculptures, value) ? value as SculptureId : ''
    },
  },
})

/** Preview one registered sculpture regardless of the seed. Unknown IDs leave the seeded pick alone. */
export function readSculpture(input: URL | string = typeof location === 'undefined' ? '' : location.href): SculptureId | '' {
  return readPermalink(input, {schema: sculptureSchema}).sculpture
}

export const forcedSculpture = readSculpture()
