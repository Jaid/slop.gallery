import optis from 'optis'
import readPermalink from 'read-permalink'
import {create} from 'zustand'

/** True for every fence, false for none or the ID of a single fence. */
export type FenceDisplay = {fence: boolean | string}

const enabledValues = new Set<unknown>([true, '', 'true'])
const schema = optis({
  defaults: {show_fence: false},
  normalizations: {
    show_fence(value: unknown): FenceDisplay['fence'] {
      if (enabledValues.has(value)) {
        return true
      }
      return typeof value === 'string' && value !== 'false' ? value : false
    },
  },
})

/** The initial selection from `?show_fence` or `?show_fence=<id>`. */
export function readShowFence(input: URL | string = typeof location === 'undefined' ? '' : location.href): FenceDisplay['fence'] {
  return readPermalink(input, {schema}).show_fence
}

export const useFenceDisplay = create<FenceDisplay>(() => ({fence: readShowFence()}))
