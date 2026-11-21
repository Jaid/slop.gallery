import type {Geofence} from 'geofency'

import {ClosedBox, SkyBox, VoidBox} from 'geofency'

import appendBoxEdges from '#src/lib/overlay/boxEdges.ts'

/** World-space line segments for every box. Only real bounds get a horizontal rim; open ends extend a camera far distance for drawing. */
export default function fenceEdges(fence: Geofence, reach: number) {
  const edges: Array<number> = []
  for (const box of fence.boxes) {
    const {x, x2, z, z2} = box
    const floor = box instanceof ClosedBox ? box.y : (box instanceof SkyBox ? box.floor : undefined)
    const ceiling = box instanceof ClosedBox ? box.y2 : (box instanceof VoidBox ? box.ceiling : undefined)
    const bottom = floor ?? (ceiling ?? 0) - reach
    const top = ceiling ?? (floor ?? 0) + reach
    appendBoxEdges(edges, [x, bottom, z], [x2, top, z2], floor !== undefined, ceiling !== undefined)
  }
  return new Float32Array(edges)
}
