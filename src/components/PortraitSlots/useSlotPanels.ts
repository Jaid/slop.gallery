import {useLayoutEffect, useRef} from 'react'

import overlay from '#src/lib/overlay/index.ts'

import SlotPanels from './SlotPanels.ts'

const layer = overlay.addLayer({
  id: 'portrait-slots',
  obstructedOpacityFactor: 0.2,
  fade: false,
})

export default function useSlotPanels(capacity: number, ghost = false) {
  const ref = useRef<SlotPanels>(null)
  useLayoutEffect(() => {
    if (!capacity) {
      return
    }
    const batch = new SlotPanels(capacity, ghost)
    const remove = overlay.addSurface(layer, batch)
    ref.current = batch
    return () => {
      ref.current = null
      remove()
    }
  }, [capacity, ghost])
  return ref
}
