import type {FenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'

import {useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import world from '#src/worlds/current.ts'

/** Changes the page’s geofence overlay without changing its URL or crossing a fence. */
export default function showFence({fence}: FenceDisplay): FenceDisplay {
  if (typeof fence === 'string' && !world.geofences.has(fence)) {
    throw new Error(`There is no fence “${fence}” in ${world.title}. Use dump_geofences to list its IDs.`)
  }
  useFenceDisplay.setState({fence})
  return {fence}
}
