import type {SloperatorPlacement} from '#src/lib/gallery/sloperator/placement.ts'
import type {SloperatorSight} from '#src/lib/gallery/sloperator/sights.ts'

import {useLayoutEffect} from 'react'

import {figureBounds} from '#src/lib/gallery/sloperator/placement.ts'
import {inFrame} from '#src/lib/gallery/sloperator/sights.ts'
import appendBoxEdges from '#src/lib/overlay/boxEdges.ts'
import overlay from '#src/lib/overlay/index.ts'

const layer = overlay.addLayer({
  id: 'sloperator-sightings',
  color: '#80ff00',
})

/** Use the authored seat or standing spot even when the player has not entered its viewing fence yet. */
export default function SightBounds({sight, placement}: {
  placement?: SloperatorPlacement
  sight: SloperatorSight
}) {
  useLayoutEffect(() => {
    const {position, yaw} = placement ?? sight
    const {min, max} = figureBounds(placement?.pose === 'stand' ? undefined : sight.seat)
    const edges: Array<number> = []
    appendBoxEdges(edges, min.toArray(), max.toArray())
    for (let i = 0; i < edges.length; i += 3) {
      const [x, y, z] = inFrame(position, yaw, edges[i], edges[i + 2])
      edges[i] = x
      edges[i + 1] += y
      edges[i + 2] = z
    }
    return overlay.addSegments(new Float32Array(edges), {
      layer,
      name: sight.id,
    }).remove
  }, [placement, sight])
  return null
}
