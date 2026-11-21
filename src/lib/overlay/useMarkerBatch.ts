import {useLayoutEffect, useRef} from 'react'

import overlay from './index.ts'
import MarkerBatch from './MarkerBatch.ts'

/** Radius of a lamp or ambience emitter dot in meters, before its dark rim. */
export const markerRadius = 0.12

export default function useMarkerBatch(layer: string, capacity: number) {
  const ref = useRef<MarkerBatch>(null)
  useLayoutEffect(() => {
    if (!capacity) {
      return
    }
    const batch = new MarkerBatch(capacity)
    batch.name = layer
    const remove = overlay.addSurface(layer, batch)
    ref.current = batch
    return () => {
      ref.current = null
      remove()
    }
  }, [capacity, layer])
  return ref
}
