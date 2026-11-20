import type {FenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'

import {selectFences, useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import world from '#src/worlds/current.ts'

/** Changes the page’s geofence overlay without changing its URL or crossing a fence. */
export default function showFence({fence}: FenceDisplay): FenceDisplay {
  if (typeof fence === 'string' && !selectFences(world.geofences, fence).length) {
    throw new Error(`No fence in ${world.title} matches “${fence}”. Use dump_geofences to list its IDs.`)
  }
  useFenceDisplay.setState({fence})
  return {fence}
}
