import type {Geofence} from 'geofency'

import {ClosedBox, SkyBox, VoidBox} from 'geofency'

/** World-space line segments for every box. Only real bounds get a horizontal rim; open ends extend a camera far distance for drawing. */
export default function fenceEdges(fence: Geofence, reach: number) {
  const edges: Array<number> = []
  for (const box of fence.boxes) {
    const {x, x2, z, z2} = box
    const floor = box instanceof ClosedBox ? box.y : (box instanceof SkyBox ? box.floor : undefined)
    const ceiling = box instanceof ClosedBox ? box.y2 : (box instanceof VoidBox ? box.ceiling : undefined)
    const bottom = floor ?? (ceiling ?? 0) - reach
    const top = ceiling ?? (floor ?? 0) + reach
    for (const y of [floor, ceiling]) {
      if (!(y !== undefined)) {
        continue
      }
      edges.push(x, y, z, x2, y, z)
      edges.push(x2, y, z, x2, y, z2)
      edges.push(x2, y, z2, x, y, z2)
      edges.push(x, y, z2, x, y, z)
    }
    for (const cx of [x, x2]) {
      for (const cz of [z, z2]) {
        edges.push(cx, bottom, cz, cx, top, cz)
      }
    }
  }
  return new Float32Array(edges)
}
