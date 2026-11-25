import {compileMeshPattern, normalizeMeshPattern} from 'capture-session'
import optis from 'optis'
import readPermalink from 'read-permalink'
import {create} from 'zustand'

import isFlagOn from '#src/lib/permalinkFlag.ts'

/** True for all colliders, false for none or a pattern selecting their scene objects. */
export type ColliderDisplay = {object: boolean | string}

export function colliderPattern(value: unknown) {
  const pattern = normalizeMeshPattern(value)
  if (pattern) {
    // Reject patterns minimatch cannot compile before they reach a render or capture.
    try {
      compileMeshPattern(pattern)
      return pattern
    } catch {}
  }
}

const schema = optis({
  defaults: {show_colliders: false},
  normalizations: {
    show_colliders(value: unknown): ColliderDisplay['object'] {
      if (isFlagOn(value)) {
        return true
      }
      return value === 'false' ? false : colliderPattern(value) ?? false
    },
  },
})

export function readShowColliders(input: URL | string = typeof location === 'undefined' ? '' : location.href): ColliderDisplay['object'] {
  return readPermalink(input, {schema}).show_colliders
}

export const useColliderDisplay = create<ColliderDisplay>(() => ({object: readShowColliders()}))

export function showColliders(display: ColliderDisplay) {
  useColliderDisplay.setState(display)
  return display
}
